package com.luneng.smartstore.customer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.luneng.smartstore.auth.ActorType;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.auth.JwtService;
import com.luneng.smartstore.support.IntegrationTestBase;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class CustomerAccountControllerTest extends IntegrationTestBase {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        jdbcTemplate.update("delete from idempotency_record");
        jdbcTemplate.update("delete from inventory_ledger");
        jdbcTemplate.update("delete from order_status_history");
        jdbcTemplate.update("delete from order_item");
        jdbcTemplate.update("delete from customer_order");
        jdbcTemplate.update("delete from customer_user");
        Set<String> authKeys = redisTemplate.keys("auth:*");
        if (!authKeys.isEmpty()) {
            redisTemplate.delete(authKeys);
        }
        jdbcTemplate.update(
            """
            insert into customer_user(
                id, openid, nickname, avatar_url, pickup_name, phone, enabled
            ) values (
                1, 'openid-1', '微信用户', 'https://example.test/avatar.png',
                '李先生', '13800138000', true
            )
            """
        );
    }

    @Test
    void unfinishedOrderBlocksAccountDeletion() throws Exception {
        insertOrder("ORDER-ACTIVE", "PREPARING");
        String token = customerToken("session-active");

        mockMvc.perform(delete("/api/mini/account")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("ACCOUNT_HAS_ACTIVE_ORDERS"));

        assertThat(jdbcTemplate.queryForObject(
            "select enabled from customer_user where id = 1",
            Boolean.class
        )).isTrue();
        assertThat(jdbcTemplate.queryForObject(
            "select phone from customer_user where id = 1",
            String.class
        )).isEqualTo("13800138000");
        assertThat(redisTemplate.opsForValue().get("auth:session:session-active"))
            .isEqualTo("1");
    }

    @Test
    void terminalOrdersAreRetainedWhileProfileAndAllSessionsAreRemoved() throws Exception {
        insertOrder("ORDER-COMPLETED", "COMPLETED");
        String token = customerToken("session-one");
        redisTemplate.opsForValue().set("auth:session:session-two", "1");
        redisTemplate.opsForSet().add(
            "auth:customer-sessions:1",
            "session-one",
            "session-two"
        );

        mockMvc.perform(delete("/api/mini/account")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value("OK"));

        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from customer_order where customer_id = 1",
            Integer.class
        )).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
            "select enabled from customer_user where id = 1",
            Boolean.class
        )).isFalse();
        assertThat(jdbcTemplate.queryForObject(
            "select openid from customer_user where id = 1",
            String.class
        )).startsWith("deleted:1:");
        assertThat(jdbcTemplate.queryForObject(
            """
            select count(*) from customer_user
            where id = 1
              and nickname is null
              and avatar_url is null
              and pickup_name is null
              and phone is null
            """,
            Integer.class
        )).isEqualTo(1);
        assertThat(redisTemplate.hasKey("auth:session:session-one")).isFalse();
        assertThat(redisTemplate.hasKey("auth:session:session-two")).isFalse();
        assertThat(redisTemplate.hasKey("auth:customer-sessions:1")).isFalse();

        mockMvc.perform(get("/api/mini/profile")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isUnauthorized());
    }

    private String customerToken(String sessionId) {
        redisTemplate.opsForValue().set("auth:session:" + sessionId, "1");
        redisTemplate.opsForSet().add("auth:customer-sessions:1", sessionId);
        return jwtService.issue(
            new CurrentPrincipal(1L, ActorType.CUSTOMER, "CUSTOMER", sessionId)
        );
    }

    private void insertOrder(String orderNo, String status) {
        jdbcTemplate.update(
            """
            insert into customer_order(
                order_no, customer_id, idempotency_key, pickup_name, phone,
                total_cent, status, payment_status, inventory_released
            ) values (?, 1, ?, '李先生', '13800138000', 500, ?, 'UNPAID', false)
            """,
            orderNo,
            "key-" + orderNo,
            status
        );
    }
}
