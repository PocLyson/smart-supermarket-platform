package com.luneng.smartstore.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.luneng.smartstore.auth.ActorType;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.common.api.BusinessException;
import com.luneng.smartstore.support.IntegrationTestBase;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class AdminOrderWorkflowTest extends IntegrationTestBase {
    @Autowired
    private OrderApplicationService customerOrders;

    @Autowired
    private AdminOrderService adminOrders;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final CurrentPrincipal cashier =
        new CurrentPrincipal(9L, ActorType.STAFF, "CASHIER", "test-session");
    private String orderNo;

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
            List.of(new CreateOrderItem(10L, 2))
        )).orderNo();
    }

    @Test
    void validWorkflowRequiresPaymentBeforeCompletion() {
        adminOrders.accept(orderNo, cashier, "req-accept");
        adminOrders.markReady(orderNo, cashier, "req-ready");

        assertThatThrownBy(() -> adminOrders.complete(orderNo, cashier, "req-complete"))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("未付款");

        adminOrders.markPaid(orderNo, PaymentMethod.WECHAT_QR, cashier, "req-pay");
        adminOrders.complete(orderNo, cashier, "req-complete");

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
    void cancellationReleasesInventoryInTheSameWorkflow() {
        adminOrders.cancel(orderNo, "顾客临时不要了", cashier, "req-cancel");

        assertThat(orderRepository.findByOrderNo(orderNo).orElseThrow().getStatus())
            .isEqualTo(OrderStatus.CANCELLED);
        assertThat(jdbcTemplate.queryForObject(
            "select available_quantity from online_inventory where product_id = 10",
            Integer.class
        )).isEqualTo(5);
    }
}
