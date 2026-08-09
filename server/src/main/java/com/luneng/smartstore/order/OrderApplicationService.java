package com.luneng.smartstore.order;

import com.luneng.smartstore.audit.AuditService;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.catalog.CatalogRepository;
import com.luneng.smartstore.catalog.Product;
import com.luneng.smartstore.common.api.BusinessException;
import com.luneng.smartstore.customer.CustomerUser;
import com.luneng.smartstore.customer.CustomerUserRepository;
import com.luneng.smartstore.inventory.InventoryService;
import jakarta.persistence.EntityNotFoundException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderApplicationService {
    private static final int MAX_ITEM_QUANTITY = 999;

    private final OrderRepository orderRepository;
    private final CustomerUserRepository customerRepository;
    private final CatalogRepository catalogRepository;
    private final InventoryService inventoryService;
    private final OrderNumberGenerator orderNumberGenerator;
    private final PickupCodeGenerator pickupCodeGenerator;
    private final JdbcTemplate jdbcTemplate;
    private final AuditService auditService;

    public OrderApplicationService(
        OrderRepository orderRepository,
        CustomerUserRepository customerRepository,
        CatalogRepository catalogRepository,
        InventoryService inventoryService,
        OrderNumberGenerator orderNumberGenerator,
        PickupCodeGenerator pickupCodeGenerator,
        JdbcTemplate jdbcTemplate,
        AuditService auditService
    ) {
        this.orderRepository = orderRepository;
        this.customerRepository = customerRepository;
        this.catalogRepository = catalogRepository;
        this.inventoryService = inventoryService;
        this.orderNumberGenerator = orderNumberGenerator;
        this.pickupCodeGenerator = pickupCodeGenerator;
        this.jdbcTemplate = jdbcTemplate;
        this.auditService = auditService;
    }

    @Transactional
    public OrderView create(CreateOrderCommand command) {
        validate(command);
        lockCustomer(command.customerId());
        var existing = orderRepository.findByCustomerIdAndIdempotencyKey(
            command.customerId(),
            command.idempotencyKey()
        );
        if (existing.isPresent()) {
            return OrderView.from(existing.orElseThrow());
        }

        CustomerUser customer = customerRepository.findById(command.customerId())
            .filter(CustomerUser::isEnabled)
            .orElseThrow(EntityNotFoundException::new);
        Map<Long, Integer> quantities = merge(command.items());
        List<PricedItem> pricedItems = new ArrayList<>();
        long totalCent = 0;
        for (Map.Entry<Long, Integer> entry : quantities.entrySet()) {
            Product product = catalogRepository.productForUpdate(entry.getKey())
                .filter(item -> item.isOnShelf() && !item.isArchived())
                .orElseThrow(() -> new BusinessException(
                    "PRODUCT_UNAVAILABLE",
                    "部分商品已下架，请移除后重试",
                    HttpStatus.CONFLICT
                ));
            long subtotal = Math.multiplyExact(product.getPriceCent(), entry.getValue());
            totalCent = Math.addExact(totalCent, subtotal);
            pricedItems.add(new PricedItem(product, entry.getValue(), subtotal));
        }

        String orderNo = orderNumberGenerator.next();
        CustomerOrder order = new CustomerOrder(
            orderNo,
            customer,
            command.idempotencyKey(),
            pickupCodeGenerator.next(),
            command.pickupName().trim(),
            command.phone(),
            command.customerNote(),
            totalCent
        );
        pricedItems.forEach(item -> order.addItem(new OrderItem(
            item.product().getId(),
            item.product().getName(),
            item.product().getUnit(),
            item.product().getPriceCent(),
            item.quantity(),
            item.subtotalCent()
        )));
        order.addHistory(new OrderStatusHistory(
            null,
            OrderStatus.PENDING_CONFIRMATION,
            "CUSTOMER",
            command.customerId(),
            "创建订单"
        ));
        orderRepository.saveAndFlush(order);
        inventoryService.reserve(quantities, orderNo);
        jdbcTemplate.update(
            """
            insert into idempotency_record(customer_id, idempotency_key, order_id)
            values (?, ?, ?)
            """,
            command.customerId(), command.idempotencyKey(), order.getId()
        );
        return OrderView.from(order);
    }

    @Transactional
    public OrderView cancelByCustomer(long customerId, String orderNo) {
        CustomerOrder order = orderRepository.findLockedByOrderNo(orderNo)
            .orElseThrow(EntityNotFoundException::new);
        if (order.getCustomer().getId() != customerId) {
            throw new EntityNotFoundException();
        }
        order.cancelByCustomer(customerId);
        inventoryService.release(orderNo);
        order.markInventoryReleased();
        return OrderView.from(order);
    }

    @Transactional(readOnly = true)
    public Page<OrderView> list(long customerId, int page, int size) {
        return orderRepository.findAllByCustomerIdAndCustomerHiddenFalse(
            customerId,
            PageRequest.of(
                Math.max(page, 0),
                Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Direction.DESC, "createdAt")
            )
        ).map(OrderView::from);
    }

    @Transactional(readOnly = true)
    public OrderView detail(long customerId, String orderNo) {
        CustomerOrder order = orderRepository.findCustomerDetailedByOrderNo(orderNo)
            .orElseThrow(EntityNotFoundException::new);
        if (order.getCustomer().getId() != customerId) {
            throw new EntityNotFoundException();
        }
        return OrderView.from(order);
    }

    @Transactional
    public void hideForCustomer(
        CurrentPrincipal customer,
        String orderNo,
        String requestId
    ) {
        CustomerOrder order = orderRepository.findLockedByOrderNo(orderNo)
            .orElseThrow(EntityNotFoundException::new);
        if (order.getCustomer().getId() != customer.id()) {
            throw new EntityNotFoundException();
        }
        order.hideForCustomer();
        auditService.record(
            customer,
            "ORDER_CUSTOMER_HIDE",
            "ORDER",
            orderNo,
            "顾客从订单列表删除",
            requestId
        );
    }

    private void lockCustomer(long customerId) {
        List<Long> ids = jdbcTemplate.queryForList(
            "select id from customer_user where id = ? and enabled = true for update",
            Long.class,
            customerId
        );
        if (ids.isEmpty()) {
            throw new EntityNotFoundException();
        }
    }

    private Map<Long, Integer> merge(List<CreateOrderItem> items) {
        Map<Long, Integer> merged = new TreeMap<>();
        for (CreateOrderItem item : items) {
            if (item.productId() <= 0 || item.quantity() <= 0) {
                throw validation("商品与数量不合法");
            }
            merged.merge(item.productId(), item.quantity(), Math::addExact);
            if (merged.get(item.productId()) > MAX_ITEM_QUANTITY) {
                throw validation("单个商品数量过大");
            }
        }
        return new LinkedHashMap<>(merged);
    }

    private void validate(CreateOrderCommand command) {
        if (command.idempotencyKey() == null
            || command.idempotencyKey().isBlank()
            || command.idempotencyKey().length() > 128
            || command.pickupName() == null
            || command.pickupName().isBlank()
            || command.pickupName().length() > 40
            || command.phone() == null
            || !command.phone().matches("^1\\d{10}$")
            || (command.customerNote() != null && command.customerNote().trim().length() > 100)
            || command.items() == null
            || command.items().isEmpty()) {
            throw validation("订单参数不合法");
        }
    }

    private BusinessException validation(String message) {
        return new BusinessException("VALIDATION_ERROR", message, HttpStatus.BAD_REQUEST);
    }

    private record PricedItem(Product product, int quantity, long subtotalCent) {
    }
}
