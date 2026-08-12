package com.luneng.smartstore.support;

import com.luneng.smartstore.common.api.BusinessException;
import com.luneng.smartstore.customer.CustomerUser;
import com.luneng.smartstore.customer.CustomerUserRepository;
import com.luneng.smartstore.order.CustomerOrder;
import com.luneng.smartstore.order.OrderRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SupportChatService {
    private static final int MAX_PAGE_SIZE = 50;
    private static final int PREVIEW_LENGTH = 80;

    private final SupportConversationRepository conversations;
    private final SupportMessageRepository messages;
    private final CustomerUserRepository customers;
    private final OrderRepository orders;

    public SupportChatService(
        SupportConversationRepository conversations,
        SupportMessageRepository messages,
        CustomerUserRepository customers,
        OrderRepository orders
    ) {
        this.conversations = conversations;
        this.messages = messages;
        this.customers = customers;
        this.orders = orders;
    }

    @Transactional
    public SupportConversationView openForCustomer(long customerId, String orderNo) {
        customers.findByIdForUpdate(customerId).orElseThrow(this::customerNotFound);
        CustomerOrder relatedOrder = customerOrder(customerId, orderNo);
        SupportConversation conversation = conversations
            .findByCustomerIdForUpdate(customerId)
            .orElseGet(() -> conversations.save(new SupportConversation(
                customerId,
                relatedOrder == null ? null : relatedOrder.getId()
            )));
        if (relatedOrder != null) {
            conversation.relateOrder(relatedOrder.getId());
        }
        return conversationView(conversation, false);
    }

    @Transactional(readOnly = true)
    public List<SupportMessageView> customerMessages(
        long customerId,
        long conversationId,
        long afterId,
        int size
    ) {
        SupportConversation conversation = customerConversation(customerId, conversationId);
        return messageViews(conversation, afterId, size);
    }

    @Transactional(readOnly = true)
    public List<SupportMessageView> merchantMessages(
        long conversationId,
        long afterId,
        int size
    ) {
        SupportConversation conversation = conversation(conversationId);
        return messageViews(conversation, afterId, size);
    }

    @Transactional(readOnly = true)
    public Page<SupportConversationView> merchantConversations(int page, int size) {
        PageRequest pageable = PageRequest.of(
            Math.max(0, page),
            normalizedSize(size)
        );
        return conversations
            .findAllByLastMessageAtIsNotNullOrderByLastMessageAtDescIdDesc(pageable)
            .map(conversation -> conversationView(conversation, true));
    }

    @Transactional
    public SupportMessageView sendByCustomer(
        long customerId,
        long conversationId,
        SupportSendMessageRequest request
    ) {
        SupportConversation conversation = lockedCustomerConversation(
            customerId,
            conversationId
        );
        CustomerOrder relatedOrder = customerOrder(customerId, request.orderNo());
        return send(
            conversation,
            SupportSenderType.CUSTOMER,
            customerId,
            relatedOrder,
            request.clientMessageId(),
            request.content()
        );
    }

    @Transactional
    public SupportMessageView sendByMerchant(
        long staffId,
        long conversationId,
        SupportSendMessageRequest request
    ) {
        SupportConversation conversation = lockedConversation(conversationId);
        CustomerOrder relatedOrder = merchantOrder(request.orderNo());
        return send(
            conversation,
            SupportSenderType.MERCHANT,
            staffId,
            relatedOrder,
            request.clientMessageId(),
            request.content()
        );
    }

    @Transactional
    public SupportConversationView markCustomerRead(
        long customerId,
        long conversationId,
        long lastMessageId
    ) {
        SupportConversation conversation = lockedCustomerConversation(
            customerId,
            conversationId
        );
        requireMessageInConversation(conversationId, lastMessageId);
        long remaining = messages.countByConversationIdAndSenderTypeAndIdGreaterThan(
            conversationId,
            SupportSenderType.MERCHANT,
            lastMessageId
        );
        conversation.markCustomerRead(Math.toIntExact(remaining));
        return conversationView(conversation, false);
    }

    @Transactional
    public SupportConversationView markMerchantRead(
        long conversationId,
        long lastMessageId
    ) {
        SupportConversation conversation = lockedConversation(conversationId);
        requireMessageInConversation(conversationId, lastMessageId);
        long remaining = messages.countByConversationIdAndSenderTypeAndIdGreaterThan(
            conversationId,
            SupportSenderType.CUSTOMER,
            lastMessageId
        );
        conversation.markMerchantRead(Math.toIntExact(remaining));
        return conversationView(conversation, true);
    }

    private SupportMessageView send(
        SupportConversation conversation,
        SupportSenderType senderType,
        long senderId,
        CustomerOrder relatedOrder,
        String clientMessageId,
        String content
    ) {
        String normalizedClientId = normalizeClientMessageId(clientMessageId);
        SupportMessage duplicate = messages
            .findBySenderTypeAndSenderIdAndClientMessageId(
                senderType,
                senderId,
                normalizedClientId
            )
            .orElse(null);
        if (duplicate != null) {
            if (duplicate.getConversationId() != conversation.getId()) {
                throw new BusinessException(
                    "SUPPORT_MESSAGE_ID_CONFLICT",
                    "消息标识已用于其他会话"
                );
            }
            return messageView(duplicate);
        }

        String normalizedContent = normalizeContent(content);
        Long relatedOrderId = relatedOrder == null ? null : relatedOrder.getId();
        SupportMessage message = messages.saveAndFlush(new SupportMessage(
            conversation.getId(),
            senderType,
            senderId,
            relatedOrderId,
            normalizedClientId,
            normalizedContent
        ));
        conversation.recordMessage(
            senderType,
            preview(normalizedContent),
            message.getCreatedAt() == null ? Instant.now() : message.getCreatedAt(),
            relatedOrderId
        );
        return messageView(message);
    }

    private List<SupportMessageView> messageViews(
        SupportConversation conversation,
        long afterId,
        int size
    ) {
        int pageSize = normalizedSize(size);
        List<SupportMessage> source;
        if (afterId > 0) {
            source = messages.findByConversationIdAndIdGreaterThanOrderByIdAsc(
                conversation.getId(),
                afterId,
                PageRequest.of(0, pageSize)
            );
        } else {
            source = new ArrayList<>(messages.findByConversationIdOrderByIdDesc(
                conversation.getId(),
                PageRequest.of(0, pageSize)
            ).getContent());
            Collections.reverse(source);
        }
        return source.stream().map(this::messageView).toList();
    }

    private SupportConversation customerConversation(long customerId, long conversationId) {
        SupportConversation conversation = conversation(conversationId);
        if (conversation.getCustomerId() != customerId) {
            throw conversationNotFound();
        }
        return conversation;
    }

    private SupportConversation lockedCustomerConversation(
        long customerId,
        long conversationId
    ) {
        SupportConversation conversation = lockedConversation(conversationId);
        if (conversation.getCustomerId() != customerId) {
            throw conversationNotFound();
        }
        return conversation;
    }

    private SupportConversation conversation(long conversationId) {
        return conversations.findById(conversationId)
            .orElseThrow(this::conversationNotFound);
    }

    private SupportConversation lockedConversation(long conversationId) {
        return conversations.findByIdForUpdate(conversationId)
            .orElseThrow(this::conversationNotFound);
    }

    private CustomerOrder customerOrder(long customerId, String orderNo) {
        String normalized = normalizeOptionalOrderNo(orderNo);
        if (normalized == null) {
            return null;
        }
        return orders.findByOrderNo(normalized)
            .filter(order -> order.getCustomer().getId() == customerId)
            .orElseThrow(this::orderNotFound);
    }

    private CustomerOrder merchantOrder(String orderNo) {
        String normalized = normalizeOptionalOrderNo(orderNo);
        if (normalized == null) {
            return null;
        }
        return orders.findByOrderNo(normalized).orElseThrow(this::orderNotFound);
    }

    private SupportConversationView conversationView(
        SupportConversation conversation,
        boolean merchantSide
    ) {
        CustomerUser customer = customers.findById(conversation.getCustomerId())
            .orElseThrow(this::customerNotFound);
        CustomerOrder relatedOrder = conversation.getLastRelatedOrderId() == null
            ? null
            : orders.findById(conversation.getLastRelatedOrderId()).orElse(null);
        String displayName = firstNonBlank(
            customer.getNickname(),
            customer.getPickupName(),
            relatedOrder == null ? null : relatedOrder.getPickupName(),
            "微信顾客"
        );
        String phone = firstNonBlank(
            customer.getPhone(),
            relatedOrder == null ? null : relatedOrder.getPhone(),
            null
        );
        return new SupportConversationView(
            conversation.getId(),
            displayName,
            maskPhone(phone),
            relatedOrder == null ? null : relatedOrder.getOrderNo(),
            conversation.getLastMessagePreview(),
            conversation.getLastMessageAt(),
            merchantSide
                ? conversation.getMerchantUnreadCount()
                : conversation.getCustomerUnreadCount()
        );
    }

    private SupportMessageView messageView(SupportMessage message) {
        String orderNo = message.getRelatedOrderId() == null
            ? null
            : orders.findById(message.getRelatedOrderId())
                .map(CustomerOrder::getOrderNo)
                .orElse(null);
        return new SupportMessageView(
            message.getId(),
            message.getSenderType(),
            message.getContent(),
            orderNo,
            message.getCreatedAt()
        );
    }

    private void requireMessageInConversation(long conversationId, long messageId) {
        if (!messages.existsByIdAndConversationId(messageId, conversationId)) {
            throw new BusinessException(
                "SUPPORT_MESSAGE_NOT_FOUND",
                "消息不存在",
                HttpStatus.NOT_FOUND
            );
        }
    }

    private int normalizedSize(int size) {
        return Math.min(MAX_PAGE_SIZE, Math.max(1, size));
    }

    private String normalizeContent(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty() || normalized.length() > 500) {
            throw new BusinessException(
                "VALIDATION_ERROR",
                "消息内容需为1至500个字符",
                HttpStatus.BAD_REQUEST
            );
        }
        return normalized;
    }

    private String normalizeClientMessageId(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty() || normalized.length() > 64) {
            throw new BusinessException(
                "VALIDATION_ERROR",
                "消息标识不合法",
                HttpStatus.BAD_REQUEST
            );
        }
        return normalized;
    }

    private String normalizeOptionalOrderNo(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String preview(String value) {
        return value.length() <= PREVIEW_LENGTH
            ? value
            : value.substring(0, PREVIEW_LENGTH);
    }

    private String maskPhone(String value) {
        if (value == null || value.isBlank()) {
            return "未提供";
        }
        if (value.matches("\\d{11}")) {
            return value.substring(0, 3) + "****" + value.substring(7);
        }
        if (value.length() > 5) {
            return value.substring(0, 3) + "***" + value.substring(value.length() - 2);
        }
        return "***";
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private BusinessException conversationNotFound() {
        return new BusinessException(
            "SUPPORT_CONVERSATION_NOT_FOUND",
            "会话不存在",
            HttpStatus.NOT_FOUND
        );
    }

    private BusinessException orderNotFound() {
        return new BusinessException(
            "ORDER_NOT_FOUND",
            "订单不存在",
            HttpStatus.NOT_FOUND
        );
    }

    private BusinessException customerNotFound() {
        return new BusinessException(
            "CUSTOMER_NOT_FOUND",
            "顾客不存在",
            HttpStatus.NOT_FOUND
        );
    }
}
