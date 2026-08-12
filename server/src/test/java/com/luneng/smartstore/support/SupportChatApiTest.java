package com.luneng.smartstore.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luneng.smartstore.auth.ActorType;
import com.luneng.smartstore.auth.ClientType;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.auth.JwtService;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class SupportChatApiTest extends IntegrationTestBase {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private ObjectMapper objectMapper;

    private String customerOneToken;
    private String customerTwoToken;
    private String cashierToken;
    private String ownerToken;

    @AfterEach
    void cleanSupportData() {
        jdbcTemplate.update("delete from customer_support_message");
        jdbcTemplate.update("delete from customer_support_conversation");
    }

    @BeforeEach
    void setUp() {
        Set<String> redisKeys = redisTemplate.keys("auth:*");
        if (!redisKeys.isEmpty()) {
            redisTemplate.delete(redisKeys);
        }
        jdbcTemplate.update("delete from customer_support_message");
        jdbcTemplate.update("delete from customer_support_conversation");
        jdbcTemplate.update("delete from operation_log");
        jdbcTemplate.update("delete from idempotency_record");
        jdbcTemplate.update("delete from inventory_ledger");
        jdbcTemplate.update("delete from order_status_history");
        jdbcTemplate.update("delete from order_item");
        jdbcTemplate.update("delete from customer_order");
        jdbcTemplate.update("delete from customer_user");
        jdbcTemplate.update("""
            insert into customer_user(
                id, openid, nickname, pickup_name, phone, enabled
            ) values
                (1, 'support-openid-1', '李先生', '李松', '13800138000', true),
                (2, 'support-openid-2', null, '王女士', '13900139000', true)
            """);
        insertOrder(1, "SUPPORT-ORDER-1", 1, "李松", "13800138000");
        insertOrder(2, "SUPPORT-ORDER-2", 2, "王女士", "13900139000");

        customerOneToken = customerToken(1, "support-customer-session-1");
        customerTwoToken = customerToken(2, "support-customer-session-2");
        cashierToken = merchantToken(9, "CASHIER", "support-cashier-session");
        ownerToken = merchantToken(8, "OWNER", "support-owner-session");
    }

    @Test
    void customerAndCashierCanExchangeIdempotentOrderLinkedMessagesAndReadThem()
        throws Exception {
        long conversationId = openConversation(customerOneToken, "SUPPORT-ORDER-1");

        String customerMessage = objectMapper.writeValueAsString(Map.of(
            "content", "  请问什么时候可以取货？  ",
            "orderNo", "SUPPORT-ORDER-1",
            "clientMessageId", "customer-message-1"
        ));
        for (int request = 0; request < 2; request++) {
            mockMvc.perform(post(
                    "/api/mini/support/conversations/{conversationId}/messages",
                    conversationId
                )
                .header("Authorization", "Bearer " + customerOneToken)
                .contentType(APPLICATION_JSON)
                .content(customerMessage))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").value("请问什么时候可以取货？"))
                .andExpect(jsonPath("$.data.senderSide").value("CUSTOMER"))
                .andExpect(jsonPath("$.data.relatedOrderNo").value("SUPPORT-ORDER-1"));
        }
        assertThat(messageCount()).isEqualTo(1);
        assertThat(merchantUnread(conversationId)).isEqualTo(1);

        mockMvc.perform(get("/api/merchant-mini/support/conversations")
                .header("Authorization", "Bearer " + cashierToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items[0].id").value(conversationId))
            .andExpect(jsonPath("$.data.items[0].customerDisplayName").value("李先生"))
            .andExpect(jsonPath("$.data.items[0].maskedPhone").value("138****8000"))
            .andExpect(jsonPath("$.data.items[0].unreadCount").value(1))
            .andExpect(jsonPath("$.data.items[0].relatedOrderNo").value("SUPPORT-ORDER-1"));

        String merchantReply = objectMapper.writeValueAsString(Map.of(
            "content", "商品备齐后会通知您。",
            "clientMessageId", "cashier-message-1"
        ));
        for (int request = 0; request < 2; request++) {
            mockMvc.perform(post(
                    "/api/merchant-mini/support/conversations/{conversationId}/messages",
                    conversationId
                )
                .header("Authorization", "Bearer " + cashierToken)
                .contentType(APPLICATION_JSON)
                .content(merchantReply))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.senderSide").value("MERCHANT"));
        }
        assertThat(messageCount()).isEqualTo(2);
        assertThat(customerUnread(conversationId)).isEqualTo(1);

        mockMvc.perform(get(
                "/api/mini/support/conversations/{conversationId}/messages",
                conversationId
            )
            .header("Authorization", "Bearer " + customerOneToken)
            .param("afterId", "0")
            .param("size", "50"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data[0].senderSide").value("CUSTOMER"))
            .andExpect(jsonPath("$.data[1].senderSide").value("MERCHANT"));

        long lastMessageId = jdbcTemplate.queryForObject(
            "select max(id) from customer_support_message",
            Long.class
        );
        mockMvc.perform(post(
                "/api/mini/support/conversations/{conversationId}/read",
                conversationId
            )
            .header("Authorization", "Bearer " + customerOneToken)
            .contentType(APPLICATION_JSON)
            .content("{\"lastMessageId\":" + lastMessageId + "}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.unreadCount").value(0));
        assertThat(customerUnread(conversationId)).isZero();
    }

    @Test
    void customerCannotUseAnotherCustomersOrderOrConversation() throws Exception {
        long conversationId = openConversation(customerOneToken, "SUPPORT-ORDER-1");

        mockMvc.perform(post("/api/mini/support/conversations")
                .header("Authorization", "Bearer " + customerOneToken)
                .contentType(APPLICATION_JSON)
                .content("{\"orderNo\":\"SUPPORT-ORDER-2\"}"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("ORDER_NOT_FOUND"));

        mockMvc.perform(get(
                "/api/mini/support/conversations/{conversationId}/messages",
                conversationId
            )
            .header("Authorization", "Bearer " + customerTwoToken))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("SUPPORT_CONVERSATION_NOT_FOUND"));
    }

    @Test
    void messageValidationRejectsBlankAndOverlongContent() throws Exception {
        long conversationId = openConversation(customerOneToken, null);

        mockMvc.perform(post(
                "/api/mini/support/conversations/{conversationId}/messages",
                conversationId
            )
            .header("Authorization", "Bearer " + customerOneToken)
            .contentType(APPLICATION_JSON)
            .content("{\"content\":\"   \",\"clientMessageId\":\"blank\"}"))
            .andExpect(status().isBadRequest());

        mockMvc.perform(post(
                "/api/mini/support/conversations/{conversationId}/messages",
                conversationId
            )
            .header("Authorization", "Bearer " + customerOneToken)
            .contentType(APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of(
                "content", "长".repeat(501),
                "clientMessageId", "too-long"
            ))))
            .andExpect(status().isBadRequest());
        assertThat(messageCount()).isZero();
    }

    @Test
    void messageValidationUsesTheTrimmedFiveHundredCharacterBoundary() throws Exception {
        long conversationId = openConversation(customerOneToken, null);
        String content = "信".repeat(500);

        mockMvc.perform(post(
                "/api/mini/support/conversations/{conversationId}/messages",
                conversationId
            )
            .header("Authorization", "Bearer " + customerOneToken)
            .contentType(APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of(
                "content", "  " + content + "  ",
                "clientMessageId", "trimmed-boundary"
            ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content").value(content));
    }

    @Test
    void bothMerchantRolesCanReplyAndDashboardCountsUnreadConversations()
        throws Exception {
        long conversationId = openConversation(customerOneToken, null);
        sendCustomerMessage(conversationId, "需要帮助", "dashboard-message");

        mockMvc.perform(get("/api/merchant-mini/dashboard")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.waitingConversationCount").value(1));

        mockMvc.perform(post(
                "/api/merchant-mini/support/conversations/{conversationId}/messages",
                conversationId
            )
            .header("Authorization", "Bearer " + ownerToken)
            .contentType(APPLICATION_JSON)
            .content("{\"content\":\"老板回复\",\"clientMessageId\":\"owner-reply\"}"))
            .andExpect(status().isOk());

        mockMvc.perform(post(
                "/api/merchant-mini/support/conversations/{conversationId}/read",
                conversationId
            )
            .header("Authorization", "Bearer " + cashierToken)
            .contentType(APPLICATION_JSON)
            .content("{\"lastMessageId\":" + jdbcTemplate.queryForObject(
                "select max(id) from customer_support_message",
                Long.class
            ) + "}"))
            .andExpect(status().isOk());
    }

    @Test
    void supportRoutesRequireTheCorrectAuthenticatedClient() throws Exception {
        mockMvc.perform(post("/api/mini/support/conversations")
                .contentType(APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/mini/support/conversations")
                .header("Authorization", "Bearer " + cashierToken)
                .contentType(APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/merchant-mini/support/conversations")
                .header("Authorization", "Bearer " + customerOneToken))
            .andExpect(status().isForbidden());
    }

    private long openConversation(String token, String orderNo) throws Exception {
        String content = orderNo == null
            ? "{}"
            : objectMapper.writeValueAsString(Map.of("orderNo", orderNo));
        mockMvc.perform(post("/api/mini/support/conversations")
                .header("Authorization", "Bearer " + token)
                .contentType(APPLICATION_JSON)
                .content(content))
            .andExpect(status().isOk());
        return jdbcTemplate.queryForObject(
            "select id from customer_support_conversation where customer_id = 1",
            Long.class
        );
    }

    private void sendCustomerMessage(long conversationId, String content, String clientId)
        throws Exception {
        mockMvc.perform(post(
                "/api/mini/support/conversations/{conversationId}/messages",
                conversationId
            )
            .header("Authorization", "Bearer " + customerOneToken)
            .contentType(APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of(
                "content", content,
                "clientMessageId", clientId
            ))))
            .andExpect(status().isOk());
    }

    private void insertOrder(
        long id,
        String orderNo,
        long customerId,
        String pickupName,
        String phone
    ) {
        jdbcTemplate.update("""
            insert into customer_order(
                id, order_no, customer_id, idempotency_key, pickup_code,
                pickup_name, phone, total_cent, status, payment_status
            ) values (?, ?, ?, ?, ?, ?, ?, 100, 'PENDING_CONFIRMATION', 'UNPAID')
            """,
            id,
            orderNo,
            customerId,
            "idempotency-" + id,
            String.format("%06d", id),
            pickupName,
            phone
        );
    }

    private String customerToken(long customerId, String sessionId) {
        CurrentPrincipal principal = new CurrentPrincipal(
            customerId,
            ActorType.CUSTOMER,
            "CUSTOMER",
            sessionId,
            ClientType.CUSTOMER_MINI
        );
        redisTemplate.opsForValue().set("auth:session:" + sessionId, Long.toString(customerId));
        return jwtService.issue(principal);
    }

    private String merchantToken(long staffId, String role, String sessionId) {
        CurrentPrincipal principal = new CurrentPrincipal(
            staffId,
            ActorType.STAFF,
            role,
            sessionId,
            ClientType.MERCHANT_MINI
        );
        redisTemplate.opsForValue().set("auth:session:" + sessionId, Long.toString(staffId));
        redisTemplate.opsForValue().set("auth:merchant-staff:" + staffId, sessionId);
        return jwtService.issue(principal);
    }

    private int messageCount() {
        return jdbcTemplate.queryForObject(
            "select count(*) from customer_support_message",
            Integer.class
        );
    }

    private int merchantUnread(long conversationId) {
        return jdbcTemplate.queryForObject(
            "select merchant_unread_count from customer_support_conversation where id = ?",
            Integer.class,
            conversationId
        );
    }

    private int customerUnread(long conversationId) {
        return jdbcTemplate.queryForObject(
            "select customer_unread_count from customer_support_conversation where id = ?",
            Integer.class,
            conversationId
        );
    }
}
