package com.luneng.smartstore.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.luneng.smartstore.auth.ActorType;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.auth.JwtService;
import com.luneng.smartstore.common.api.BusinessException;
import com.luneng.smartstore.support.IntegrationTestBase;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class AdminOrderWorkflowTest extends IntegrationTestBase {
    @Autowired
    private OrderApplicationService customerOrders;

    @Autowired
    private AdminOrderService adminOrders;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private StringRedisTemplate redisTemplate;

    private final CurrentPrincipal cashier =
        new CurrentPrincipal(9L, ActorType.STAFF, "CASHIER", "test-session");
    private String orderNo;
    private String staffToken;

    @BeforeEach
    void setUp() {
        jdbcTemplate.update("delete from operation_log");
        jdbcTemplate.update("delete from idempotency_record");
        jdbcTemplate.update("delete from inventory_ledger");
        jdbcTemplate.update("delete from order_status_history");
        jdbcTemplate.update("delete from order_item");
        jdbcTemplate.update("delete from customer_order");
        jdbcTemplate.update("delete from online_inventory");
        jdbcTemplate.update("delete from product");
        jdbcTemplate.update("delete from category");
        jdbcTemplate.update("delete from customer_user");
        jdbcTemplate.update(
            "insert into customer_user(id, openid, enabled) values (1, 'order-owner', true)"
        );
        jdbcTemplate.update(
            "insert into category(id, name, sort_order, enabled) values (1, '乳制品', 1, true)"
        );
        jdbcTemplate.update(
            """
            insert into product(id, category_id, name, price_cent, unit, on_shelf)
            values (10, 1, '纯牛奶', 590, '盒', true)
            """
        );
        jdbcTemplate.update(
            "insert into online_inventory(product_id, available_quantity, version) values (10, 5, 0)"
        );
        orderNo = customerOrders.create(new CreateOrderCommand(
            1L,
            "admin-flow",
            "李先生",
            "13800138000",
            null,
            List.of(new CreateOrderItem(10L, 2))
        )).orderNo();
        redisTemplate.opsForValue().set("auth:session:test-session", "9");
        staffToken = jwtService.issue(cashier);
    }

    @Test
    void validWorkflowRequiresPaymentBeforeCompletion() {
        adminOrders.accept(orderNo, cashier, "req-accept");
        adminOrders.markReady(orderNo, cashier, "req-ready");

        assertThatThrownBy(() -> adminOrders.complete(
            orderNo,
            customerOrders.detail(1L, orderNo).pickupCode(),
            cashier,
            "req-complete"
        ))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("未付款");

        adminOrders.markPaid(orderNo, PaymentMethod.WECHAT_QR, cashier, "req-pay");
        String pickupCode = customerOrders.detail(1L, orderNo).pickupCode();
        String incorrectCode = pickupCode.equals("000000") ? "111111" : "000000";

        assertThatThrownBy(() -> adminOrders.complete(
            orderNo,
            incorrectCode,
            cashier,
            "req-complete-wrong"
        ))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("取货码不正确");
        assertThat(orderRepository.findByOrderNo(orderNo).orElseThrow().getStatus())
            .isEqualTo(OrderStatus.READY_FOR_PICKUP);

        adminOrders.complete(orderNo, pickupCode, cashier, "req-complete");

        CustomerOrder order = orderRepository.findByOrderNo(orderNo).orElseThrow();
        assertThat(order.getStatus()).isEqualTo(OrderStatus.COMPLETED);
        assertThat(order.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from operation_log where object_id = ?",
            Integer.class,
            orderNo
        )).isEqualTo(4);
    }

    @Test
    void completeEndpointRequiresAValidSixDigitPickupCode() throws Exception {
        adminOrders.accept(orderNo, cashier, "req-accept");
        adminOrders.markReady(orderNo, cashier, "req-ready");
        adminOrders.markPaid(orderNo, PaymentMethod.CASH, cashier, "req-pay");

        mockMvc.perform(post("/api/admin/orders/{orderNo}/complete", orderNo)
                .header("Authorization", "Bearer " + staffToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/admin/orders/{orderNo}/complete", orderNo)
                .header("Authorization", "Bearer " + staffToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"pickupCode":"12"}
                    """))
            .andExpect(status().isBadRequest());

        String pickupCode = customerOrders.detail(1L, orderNo).pickupCode();
        mockMvc.perform(post("/api/admin/orders/{orderNo}/complete", orderNo)
                .header("Authorization", "Bearer " + staffToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"pickupCode":"%s"}
                    """.formatted(pickupCode)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("COMPLETED"))
            .andExpect(jsonPath("$.data.pickupCode").doesNotExist());
    }

    @Test
    void cancellationReleasesInventoryInTheSameWorkflow() {
        adminOrders.cancel(orderNo, "顾客临时不要了", cashier, "req-cancel");

        assertThat(orderRepository.findByOrderNo(orderNo).orElseThrow().getStatus())
            .isEqualTo(OrderStatus.CANCELLED);
        assertThat(jdbcTemplate.queryForObject(
            "select available_quantity from online_inventory where product_id = 10",
            Integer.class
        )).isEqualTo(5);
    }

    @Test
    void adminCanArchiveTerminalOrderWithoutHidingItFromCustomer() throws Exception {
        adminOrders.cancel(orderNo, "顾客不再需要", cashier, "req-cancel");

        mockMvc.perform(delete("/api/admin/orders/{orderNo}", orderNo)
                .header("Authorization", "Bearer " + staffToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.deleted").value(true));

        assertThat(adminOrders.list(null, null, "", false, 0, 20).getTotalElements())
            .isZero();
        assertThat(adminOrders.list(null, null, "", true, 0, 20).getTotalElements())
            .isEqualTo(1);
        mockMvc.perform(get("/api/admin/orders/{orderNo}", orderNo)
                .header("Authorization", "Bearer " + staffToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.orderNo").value(orderNo))
            .andExpect(jsonPath("$.data.pickupCode").doesNotExist());

        mockMvc.perform(post("/api/admin/orders/{orderNo}/restore", orderNo)
                .header("Authorization", "Bearer " + staffToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.orderNo").value(orderNo));

        assertThat(adminOrders.list(null, null, "", false, 0, 20).getTotalElements())
            .isEqualTo(1);
        assertThat(adminOrders.list(null, null, "", true, 0, 20).getTotalElements())
            .isZero();
        assertThat(customerOrders.list(1L, 0, 20).getTotalElements()).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from customer_order where order_no = ?",
            Integer.class,
            orderNo
        )).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from operation_log where action = 'ORDER_RESTORE' and object_id = ?",
            Integer.class,
            orderNo
        )).isEqualTo(1);
    }

    @Test
    void adminCannotArchiveActiveOrder() throws Exception {
        mockMvc.perform(delete("/api/admin/orders/{orderNo}", orderNo)
                .header("Authorization", "Bearer " + staffToken))
            .andExpect(status().isConflict());

        assertThat(adminOrders.list(null, null, "", false, 0, 20).getTotalElements())
            .isEqualTo(1);
    }
}
