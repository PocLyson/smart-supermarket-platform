package com.luneng.smartstore.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doAnswer;

import com.luneng.smartstore.auth.ActorType;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.catalog.CatalogRepository;
import com.luneng.smartstore.catalog.CatalogService;
import com.luneng.smartstore.inventory.InventoryService;
import com.luneng.smartstore.support.IntegrationTestBase;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

class OrderConcurrencyTest extends IntegrationTestBase {
    @Autowired
    private OrderApplicationService service;

    @Autowired
    private InventoryService inventoryService;

    @Autowired
    private CatalogService catalogService;

    @MockitoSpyBean
    private CatalogRepository catalogRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

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
                        null,
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

    @Test
    void checkoutCannotCommitAfterACompetingArchiveHasCommitted() throws Exception {
        var productChecked = new CountDownLatch(1);
        var archiveCommitted = new CountDownLatch(1);
        var completionSequence = new AtomicLong();
        var checkoutCompletedAt = new AtomicLong();
        var archiveCompletedAt = new AtomicLong();
        coordinateCheckoutRead(productChecked, archiveCommitted);
        var pool = Executors.newFixedThreadPool(2);
        try {
            Future<OrderView> checkout = pool.submit(() -> {
                Thread.currentThread().setName("checkout-writer");
                OrderView result = service.create(new CreateOrderCommand(
                    1L,
                    "archive-race",
                    "顾客1",
                    "13800138001",
                    null,
                    List.of(new CreateOrderItem(10L, 1))
                ));
                checkoutCompletedAt.set(completionSequence.incrementAndGet());
                return result;
            });
            assertThat(productChecked.await(5, TimeUnit.SECONDS)).isTrue();
            Future<CatalogService.ProductView> archive = pool.submit(() -> {
                Thread.currentThread().setName("archive-writer");
                CatalogService.ProductView result = catalogService.archive(
                    10L,
                    new CurrentPrincipal(9L, ActorType.STAFF, "OWNER", "archive-session"),
                    "checkout-race-archive"
                );
                archiveCompletedAt.set(completionSequence.incrementAndGet());
                return result;
            });
            try {
                archive.get(10, TimeUnit.SECONDS);
            } finally {
                archiveCommitted.countDown();
            }
            checkout.get(10, TimeUnit.SECONDS);
        } finally {
            archiveCommitted.countDown();
            pool.shutdownNow();
        }

        assertThat(checkoutCompletedAt.get()).isPositive();
        assertThat(checkoutCompletedAt.get()).isLessThan(archiveCompletedAt.get());
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from customer_order where idempotency_key = 'archive-race'",
            Integer.class
        )).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
            "select archived from product where id = 10",
            Boolean.class
        )).isTrue();
    }

    private void coordinateCheckoutRead(
        CountDownLatch productChecked,
        CountDownLatch archiveCommitted
    ) {
        doAnswer(invocation -> {
            Object product = invocation.callRealMethod();
            if ("checkout-writer".equals(Thread.currentThread().getName())) {
                productChecked.countDown();
                assertThat(archiveCommitted.await(10, TimeUnit.SECONDS)).isTrue();
            }
            return product;
        }).when(catalogRepository).product(anyLong());
        doAnswer(invocation -> {
            Object product = invocation.callRealMethod();
            if ("checkout-writer".equals(Thread.currentThread().getName())) {
                productChecked.countDown();
            }
            return product;
        }).when(catalogRepository).productForUpdate(anyLong());
    }
}
