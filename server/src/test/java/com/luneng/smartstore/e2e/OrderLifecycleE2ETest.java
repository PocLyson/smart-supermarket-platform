package com.luneng.smartstore.e2e;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.luneng.smartstore.auth.ActorType;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.catalog.CatalogService;
import com.luneng.smartstore.inventory.InventoryRepository;
import com.luneng.smartstore.inventory.InventoryService;
import com.luneng.smartstore.order.AdminOrderService;
import com.luneng.smartstore.order.CreateOrderCommand;
import com.luneng.smartstore.order.CreateOrderItem;
import com.luneng.smartstore.order.CustomerOrder;
import com.luneng.smartstore.order.OrderApplicationService;
import com.luneng.smartstore.order.OrderRepository;
import com.luneng.smartstore.order.OrderStatus;
import com.luneng.smartstore.order.OrderView;
import com.luneng.smartstore.order.PaymentMethod;
import com.luneng.smartstore.order.PaymentStatus;
import com.luneng.smartstore.support.IntegrationTestBase;
import jakarta.persistence.EntityNotFoundException;
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
    private CatalogService catalogService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final CurrentPrincipal cashier =
        new CurrentPrincipal(8L, ActorType.STAFF, "CASHIER", "e2e-session");
    private final CurrentPrincipal owner =
        new CurrentPrincipal(9L, ActorType.STAFF, "OWNER", "archive-history-session");

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
            null,
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

    @Test
    void archivedProductDisappearsFromCatalogWithoutChangingHistoricalOrder() {
        jdbcTemplate.update(
            "update product set name = ?, price_cent = ? where id = ?",
            "无糖乌龙茶 500ml",
            500,
            10L
        );
        OrderView completed = createAndCompleteOrderForProduct(10L);
        int ledgerRowsBeforeArchive = jdbcTemplate.queryForObject(
            "select count(*) from inventory_ledger where product_id = 10",
            Integer.class
        );

        catalogService.archive(10L, owner, "archive-history-product");

        assertThatThrownBy(() -> catalogService.product(10L, true))
            .isInstanceOf(EntityNotFoundException.class);

        OrderView historical = customerOrders.detail(1L, completed.orderNo());
        assertThat(historical.totalCent()).isEqualTo(500);
        assertThat(historical.items()).singleElement().satisfies(item -> {
            assertThat(item.productName()).isEqualTo("无糖乌龙茶 500ml");
            assertThat(item.quantity()).isEqualTo(1);
            assertThat(item.unitPriceCent()).isEqualTo(500);
            assertThat(item.subtotalCent()).isEqualTo(500);
        });
        assertThat(historical.pickupCode()).matches("\\d{6}");
        assertThat(historical.pickupCode()).isEqualTo(completed.pickupCode());
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from operation_log where action = 'PRODUCT_ARCHIVE' and object_id = '10'",
            Integer.class
        )).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from product where id = 10",
            Integer.class
        )).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from online_inventory where product_id = 10",
            Integer.class
        )).isEqualTo(1);
        assertThat(inventoryService.current(10L)).isEqualTo(9);
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from inventory_ledger where product_id = 10",
            Integer.class
        )).isEqualTo(ledgerRowsBeforeArchive);
        assertThat(inventoryRepository.sumForOrder(completed.orderNo())).isEqualTo(-1);
    }

    private OrderView createAndCompleteOrderForProduct(long productId) {
        OrderView order = customerOrders.create(new CreateOrderCommand(
            1L,
            "archive-history-order-" + productId,
            "李先生",
            "13800138000",
            null,
            List.of(new CreateOrderItem(productId, 1))
        ));
        adminOrders.accept(order.orderNo(), cashier, "archive-history-accept");
        adminOrders.markReady(order.orderNo(), cashier, "archive-history-ready");
        adminOrders.markPaid(
            order.orderNo(),
            PaymentMethod.WECHAT_QR,
            cashier,
            "archive-history-pay"
        );
        adminOrders.complete(
            order.orderNo(),
            order.pickupCode(),
            cashier,
            "archive-history-complete"
        );
        return customerOrders.detail(1L, order.orderNo());
    }
}
