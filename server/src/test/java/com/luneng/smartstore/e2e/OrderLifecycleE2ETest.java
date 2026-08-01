package com.luneng.smartstore.e2e;

import static org.assertj.core.api.Assertions.assertThat;

import com.luneng.smartstore.auth.ActorType;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.inventory.InventoryRepository;
import com.luneng.smartstore.inventory.InventoryService;
import com.luneng.smartstore.order.AdminOrderService;
import com.luneng.smartstore.order.CreateOrderCommand;
import com.luneng.smartstore.order.CreateOrderItem;
import com.luneng.smartstore.order.CustomerOrder;
import com.luneng.smartstore.order.OrderApplicationService;
import com.luneng.smartstore.order.OrderRepository;
import com.luneng.smartstore.order.OrderStatus;
import com.luneng.smartstore.order.PaymentMethod;
import com.luneng.smartstore.order.PaymentStatus;
import com.luneng.smartstore.support.IntegrationTestBase;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class OrderLifecycleE2ETest extends IntegrationTestBase {
    @Autowired
    private OrderApplicationService customerOrders;

    @Autowired
    private AdminOrderService adminOrders;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private InventoryService inventoryService;

    @Autowired
    private InventoryRepository inventoryRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final CurrentPrincipal cashier =
        new CurrentPrincipal(8L, ActorType.STAFF, "CASHIER", "e2e-session");

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
            "insert into customer_user(id, openid, enabled) values (1, 'lifecycle', true)"
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
            "insert into online_inventory(product_id, available_quantity, version) values (10, 10, 0)"
        );
    }

    @Test
    void customerOrderCompletesWithConsistentMoneyPaymentAndInventory() {
        var order = customerOrders.create(new CreateOrderCommand(
            1L,
            "life-001",
            "李先生",
            "13800138000",
            List.of(new CreateOrderItem(10L, 2))
        ));
        adminOrders.accept(order.orderNo(), cashier, "e2e-accept");
        adminOrders.markReady(order.orderNo(), cashier, "e2e-ready");
        adminOrders.markPaid(
            order.orderNo(),
            PaymentMethod.WECHAT_QR,
            cashier,
            "e2e-pay"
        );
        adminOrders.complete(
            order.orderNo(),
            order.pickupCode(),
            cashier,
            "e2e-complete"
        );

        CustomerOrder stored = orderRepository.findByOrderNo(order.orderNo()).orElseThrow();
        assertThat(stored.getStatus()).isEqualTo(OrderStatus.COMPLETED);
        assertThat(stored.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        assertThat(stored.getTotalCent()).isEqualTo(1180);
        assertThat(inventoryService.current(10L)).isEqualTo(8);
        assertThat(inventoryRepository.sumForOrder(order.orderNo())).isEqualTo(-2);
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from order_status_history where order_id = ?",
            Integer.class,
            stored.getId()
        )).isEqualTo(4);
    }
}
