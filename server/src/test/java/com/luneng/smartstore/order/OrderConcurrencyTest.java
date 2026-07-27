package com.luneng.smartstore.order;

import static org.assertj.core.api.Assertions.assertThat;

import com.luneng.smartstore.inventory.InventoryService;
import com.luneng.smartstore.support.IntegrationTestBase;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class OrderConcurrencyTest extends IntegrationTestBase {
    @Autowired
    private OrderApplicationService service;

    @Autowired
    private InventoryService inventoryService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        jdbcTemplate.update(
            """
            insert into customer_user(id, openid, enabled)
            values (1, 'openid-1', true), (2, 'openid-2', true)
            """
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
            "insert into online_inventory(product_id, available_quantity, version) values (10, 1, 0)"
        );
    }

    @Test
    void twoCustomersCompetingForLastUnitProduceExactlyOneOrder() throws Exception {
        var start = new CountDownLatch(1);
        var done = new CountDownLatch(2);
        var successes = new AtomicInteger();
        var pool = Executors.newFixedThreadPool(2);
        for (long customerId = 1; customerId <= 2; customerId++) {
            long id = customerId;
            pool.submit(() -> {
                try {
                    start.await();
                    service.create(new CreateOrderCommand(
                        id,
                        "race-" + id,
                        "顾客" + id,
                        "1380013800" + id,
                        List.of(new CreateOrderItem(10L, 1))
                    ));
                    successes.incrementAndGet();
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                } catch (RuntimeException ignored) {
                    // Exactly one reservation is expected to fail.
                } finally {
                    done.countDown();
                }
            });
        }

        start.countDown();
        assertThat(done.await(30, TimeUnit.SECONDS)).isTrue();
        pool.shutdownNow();

        assertThat(successes.get()).isEqualTo(1);
        assertThat(inventoryService.current(10L)).isZero();
    }
}
