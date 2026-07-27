package com.luneng.smartstore.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.luneng.smartstore.common.api.BusinessException;
import com.luneng.smartstore.inventory.InventoryService;
import com.luneng.smartstore.support.IntegrationTestBase;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class OrderApplicationServiceTest extends IntegrationTestBase {
    @Autowired
    private OrderApplicationService service;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private InventoryService inventoryService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private CreateOrderCommand command;

    @BeforeEach
    void setUp() {
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
            "insert into customer_user(id, openid, enabled) values (1, 'openid-1', true)"
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
        command = new CreateOrderCommand(
            1L,
            "req-001",
            "李先生",
            "13800138000",
            List.of(new CreateOrderItem(10L, 2))
        );
    }

    @Test
    void createOrderUsesServerPriceAndReservesStockAtomically() {
        OrderView result = service.create(command);

        assertThat(result.totalCent()).isEqualTo(1180);
        assertThat(result.status()).isEqualTo(OrderStatus.PENDING_CONFIRMATION);
        assertThat(inventoryService.current(10L)).isEqualTo(8);
        assertThat(service.detail(1L, result.orderNo()).items()).hasSize(1);
        assertThat(service.detail(1L, result.orderNo()).history()).hasSize(1);
    }

    @Test
    void duplicateIdempotencyKeyReturnsOriginalOrder() {
        OrderView first = service.create(command);
        OrderView second = service.create(command);

        assertThat(second.orderNo()).isEqualTo(first.orderNo());
        assertThat(orderRepository.count()).isEqualTo(1);
    }

    @Test
    void customerCancellationReleasesStockExactlyOnce() {
        OrderView order = service.create(command);

        service.cancelByCustomer(1L, order.orderNo());

        assertThat(inventoryService.current(10L)).isEqualTo(10);
        assertThatThrownBy(() -> service.cancelByCustomer(1L, order.orderNo()))
            .isInstanceOf(BusinessException.class);
        assertThat(inventoryService.current(10L)).isEqualTo(10);
    }
}
