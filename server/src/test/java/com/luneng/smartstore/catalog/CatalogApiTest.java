package com.luneng.smartstore.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doAnswer;
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
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

@AutoConfigureMockMvc
class CatalogApiTest extends IntegrationTestBase {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private CatalogService catalogService;

    @MockitoSpyBean
    private CatalogRepository catalogRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private StringRedisTemplate redisTemplate;

    private final CurrentPrincipal owner =
        new CurrentPrincipal(1L, ActorType.STAFF, "OWNER", "catalog-owner-session");
    private final CurrentPrincipal cashier =
        new CurrentPrincipal(2L, ActorType.STAFF, "CASHIER", "catalog-cashier-session");
    private String ownerToken;
    private String cashierToken;

    @BeforeEach
    void setUpCatalog() {
        jdbcTemplate.update("delete from operation_log");
        jdbcTemplate.update("delete from order_status_history");
        jdbcTemplate.update("delete from idempotency_record");
        jdbcTemplate.update("delete from inventory_ledger");
        jdbcTemplate.update("delete from order_item");
        jdbcTemplate.update("delete from customer_order");
        jdbcTemplate.update("delete from online_inventory");
        jdbcTemplate.update("delete from product");
        jdbcTemplate.update("delete from category");
        jdbcTemplate.update(
            "insert into category(id, name, sort_order, enabled) values (1, '乳制品', 1, true)"
        );
        jdbcTemplate.update(
            """
            insert into product(
                id, category_id, name, price_cent, unit, description, on_shelf
            ) values (10, 1, '纯牛奶', 590, '盒', '常温纯牛奶', true)
            """
        );
        jdbcTemplate.update(
            "insert into online_inventory(product_id, available_quantity, version) values (10, 20, 0)"
        );
        jdbcTemplate.update(
            """
            insert into product(
                id, category_id, name, price_cent, unit, description, on_shelf
            ) values (11, 1, '缺货新品', 690, '件', '暂时无库存', true)
            """
        );
        jdbcTemplate.update(
            "insert into online_inventory(product_id, available_quantity, version) values (11, 0, 0)"
        );
        redisTemplate.opsForValue().set("auth:session:catalog-owner-session", "1");
        redisTemplate.opsForValue().set("auth:session:catalog-cashier-session", "2");
        ownerToken = jwtService.issue(owner);
        cashierToken = jwtService.issue(cashier);
    }

    @Test
    void miniCatalogReturnsOnlyEnabledCategoriesAndOnShelfProducts() throws Exception {
        mockMvc.perform(get("/api/mini/products").param("keyword", "牛奶"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items[0].name").value("纯牛奶"))
            .andExpect(jsonPath("$.data.items[0].priceCent").value(590))
            .andExpect(jsonPath("$.data.items[0].availableStock").value(20));
    }

    @Test
    void productCreationPersistsItsInitialStock() {
        CatalogService.ProductView product = catalogService.createProduct(
            new ProductWriteRequest(
                "新鲜苹果", 1L, 990, "斤", null, "", true, 25
            ),
            new CurrentPrincipal(1L, ActorType.STAFF, "OWNER", "staff-session"),
            "catalog-create"
        );

        assertThat(product.availableStock()).isEqualTo(25);
        assertThat(jdbcTemplate.queryForObject(
            "select available_quantity from online_inventory where product_id = ?",
            Integer.class,
            product.id()
        )).isEqualTo(25);
    }

    @Test
    void miniCatalogPlacesOutOfStockProductsAfterAvailableProducts() throws Exception {
        mockMvc.perform(get("/api/mini/products").param("size", "20"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items[0].id").value(10))
            .andExpect(jsonPath("$.data.items[0].availableStock").value(20))
            .andExpect(jsonPath("$.data.items[1].id").value(11))
            .andExpect(jsonPath("$.data.items[1].availableStock").value(0));
    }

    @Test
    void ownerArchiveAndRestoreFiltersPublicAndAdminCatalogWithoutReshelving() throws Exception {
        mockMvc.perform(delete("/api/admin/products/10")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.archived").value(true))
            .andExpect(jsonPath("$.data.onShelf").value(false))
            .andExpect(jsonPath("$.data.archivedAt").isNotEmpty())
            .andExpect(jsonPath("$.data.archivedBy").value(1));

        mockMvc.perform(delete("/api/admin/products/10")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.archived").value(true));

        mockMvc.perform(get("/api/mini/products"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items[?(@.id == 10)]").doesNotExist());
        mockMvc.perform(get("/api/mini/products").param("keyword", "纯牛奶"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.total").value(0));
        mockMvc.perform(get("/api/mini/products/10"))
            .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/admin/products")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items[?(@.id == 10)]").doesNotExist());
        mockMvc.perform(get("/api/admin/products")
                .header("Authorization", "Bearer " + ownerToken)
                .param("archiveStatus", "ARCHIVED"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items[0].id").value(10))
            .andExpect(jsonPath("$.data.items[0].archived").value(true));
        mockMvc.perform(get("/api/admin/products")
                .header("Authorization", "Bearer " + ownerToken)
                .param("archiveStatus", "ALL"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.total").value(2));

        mockMvc.perform(post("/api/admin/products/10/restore")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.archived").value(false))
            .andExpect(jsonPath("$.data.onShelf").value(false))
            .andExpect(jsonPath("$.data.archivedAt").doesNotExist())
            .andExpect(jsonPath("$.data.archivedBy").doesNotExist());
        mockMvc.perform(post("/api/admin/products/10/restore")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.archived").value(false))
            .andExpect(jsonPath("$.data.onShelf").value(false));

        mockMvc.perform(get("/api/mini/products/10"))
            .andExpect(status().isNotFound());
        assertThat(auditCount("PRODUCT_ARCHIVE")).isEqualTo(1);
        assertThat(auditCount("PRODUCT_RESTORE")).isEqualTo(1);
    }

    @Test
    void cashierCannotArchiveOrRestoreProducts() throws Exception {
        mockMvc.perform(delete("/api/admin/products/10")
                .header("Authorization", "Bearer " + cashierToken))
            .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/admin/products/10/restore")
                .header("Authorization", "Bearer " + cashierToken))
            .andExpect(status().isForbidden());

        assertThat(jdbcTemplate.queryForObject(
            "select archived from product where id = 10",
            Boolean.class
        )).isFalse();
        assertThat(auditCount("PRODUCT_ARCHIVE")).isZero();
        assertThat(auditCount("PRODUCT_RESTORE")).isZero();
    }

    @Test
    void ownerCanPermanentlyDeleteAnArchivedProductAndItsInventoryData() throws Exception {
        Path uploadRoot = Path.of(
            System.getProperty("java.io.tmpdir"),
            "smart-store-test-uploads"
        );
        Files.createDirectories(uploadRoot);
        String generatedName = UUID.randomUUID() + ".jpg";
        Path coverImage = uploadRoot.resolve(generatedName);
        Files.write(coverImage, new byte[] {1, 2, 3});
        jdbcTemplate.update("update product set archived = true, on_shelf = false where id = 10");
        jdbcTemplate.update(
            "update product set cover_image_url = ? where id = 10",
            "/files/" + generatedName
        );
        jdbcTemplate.update(
            "insert into inventory_ledger(product_id, quantity_delta, quantity_before, "
                + "quantity_after, reason) values (10, 5, 15, 20, '测试库存')"
        );

        mockMvc.perform(delete("/api/admin/products/10/permanent")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.deleted").value(true));

        assertThat(countRows("product", 10)).isZero();
        assertThat(countRows("online_inventory", 10)).isZero();
        assertThat(countRows("inventory_ledger", 10)).isZero();
        assertThat(auditCount("PRODUCT_PERMANENT_DELETE")).isEqualTo(1);
        assertThat(coverImage).doesNotExist();
    }

    @Test
    void permanentDeleteKeepsAnImageStillUsedByAnotherProduct() throws Exception {
        Path uploadRoot = Path.of(
            System.getProperty("java.io.tmpdir"),
            "smart-store-test-uploads"
        );
        Files.createDirectories(uploadRoot);
        String generatedName = UUID.randomUUID() + ".jpg";
        Path sharedImage = uploadRoot.resolve(generatedName);
        Files.write(sharedImage, new byte[] {1, 2, 3});
        String imageUrl = "/files/" + generatedName;
        jdbcTemplate.update(
            "update product set archived = true, on_shelf = false, cover_image_url = ? where id = 10",
            imageUrl
        );
        jdbcTemplate.update("update product set cover_image_url = ? where id = 11", imageUrl);

        mockMvc.perform(delete("/api/admin/products/10/permanent")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk());

        assertThat(sharedImage).exists();
        Files.deleteIfExists(sharedImage);
    }

    @Test
    void concurrentImageAssignmentCannotCreateABrokenProductReference() throws Exception {
        Path uploadRoot = Path.of(
            System.getProperty("java.io.tmpdir"),
            "smart-store-test-uploads"
        );
        Files.createDirectories(uploadRoot);
        String generatedName = UUID.randomUUID() + ".jpg";
        String imageUrl = "/files/" + generatedName;
        Path image = uploadRoot.resolve(generatedName);
        Files.write(image, new byte[] {1, 2, 3});
        jdbcTemplate.update(
            "update product set archived = true, on_shelf = false, cover_image_url = ? where id = 10",
            imageUrl
        );

        var executor = Executors.newFixedThreadPool(2);
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try {
            Future<CatalogService.ProductDeletion> deleteFuture = executor.submit(() -> {
                ready.countDown();
                assertThat(start.await(5, TimeUnit.SECONDS)).isTrue();
                return catalogService.permanentDelete(10L, owner, "concurrent-delete");
            });
            Future<CatalogService.ProductView> updateFuture = executor.submit(() -> {
                ready.countDown();
                assertThat(start.await(5, TimeUnit.SECONDS)).isTrue();
                return catalogService.updateProduct(
                    11L,
                    new ProductWriteRequest(
                        "缺货新品", 1L, 690, "件", imageUrl, "暂时无库存", true, null
                    ),
                    owner,
                    "concurrent-image-update"
                );
            });
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            assertThat(deleteFuture.get(10, TimeUnit.SECONDS).deleted()).isTrue();
            try {
                updateFuture.get(10, TimeUnit.SECONDS);
            } catch (ExecutionException exception) {
                assertThat(exception.getCause())
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).getCode())
                    .isEqualTo("PRODUCT_IMAGE_UNAVAILABLE");
            }
        } finally {
            executor.shutdownNow();
        }

        String assignedImage = jdbcTemplate.queryForObject(
            "select cover_image_url from product where id = 11",
            String.class
        );
        if (imageUrl.equals(assignedImage)) {
            assertThat(image).exists();
            Files.deleteIfExists(image);
        } else {
            assertThat(image).doesNotExist();
        }
    }

    @Test
    void permanentDeleteUsesCurrentStateAndRejectsAConcurrentlyRestoredProduct()
        throws Exception {
        jdbcTemplate.update("update product set archived = true, on_shelf = false where id = 10");
        var candidateRead = new CountDownLatch(1);
        var restoreCommitted = new CountDownLatch(1);
        doAnswer(invocation -> {
            Object candidate = invocation.callRealMethod();
            if ("permanent-delete-writer".equals(Thread.currentThread().getName())) {
                candidateRead.countDown();
                assertThat(restoreCommitted.await(10, TimeUnit.SECONDS)).isTrue();
            }
            return candidate;
        }).when(catalogRepository).productDeletionCandidate(anyLong());

        var executor = Executors.newSingleThreadExecutor();
        try {
            Future<CatalogService.ProductDeletion> deleteFuture = executor.submit(() -> {
                Thread.currentThread().setName("permanent-delete-writer");
                return catalogService.permanentDelete(10L, owner, "delete-after-restore");
            });
            assertThat(candidateRead.await(5, TimeUnit.SECONDS)).isTrue();
            catalogService.restore(10L, owner, "concurrent-restore");
            restoreCommitted.countDown();

            try {
                deleteFuture.get(10, TimeUnit.SECONDS);
                throw new AssertionError("concurrently restored product must not be deleted");
            } catch (ExecutionException exception) {
                assertThat(exception.getCause())
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).getCode())
                    .isEqualTo("PRODUCT_NOT_ARCHIVED");
            }
        } finally {
            restoreCommitted.countDown();
            executor.shutdownNow();
        }

        assertThat(countRows("product", 10)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
            "select archived from product where id = 10",
            Boolean.class
        )).isFalse();
        assertThat(auditCount("PRODUCT_PERMANENT_DELETE")).isZero();
    }

    @Test
    void permanentDeleteRejectsAnActiveProduct() throws Exception {
        mockMvc.perform(delete("/api/admin/products/10/permanent")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("PRODUCT_NOT_ARCHIVED"));

        assertThat(countRows("product", 10)).isEqualTo(1);
    }

    @Test
    void permanentDeleteRejectsAProductUsedByAnOrder() throws Exception {
        jdbcTemplate.update("update product set archived = true, on_shelf = false where id = 10");
        jdbcTemplate.update(
            "insert into customer_user(id, openid, enabled) values (90, 'catalog-delete-customer', true)"
                + " on duplicate key update enabled = true"
        );
        jdbcTemplate.update(
            """
            insert into customer_order(
                id, order_no, customer_id, idempotency_key, pickup_code, pickup_name, phone,
                total_cent, status, payment_status, inventory_released
            ) values (90, 'PD202608010001', 90, 'permanent-delete-order', '345678', '测试顾客',
                      '13800000000', 590, 'COMPLETED', 'PAID', true)
            """
        );
        jdbcTemplate.update(
            """
            insert into order_item(
                order_id, product_id, product_name, unit, unit_price_cent, quantity, subtotal_cent
            ) values (90, 10, '纯牛奶', '盒', 590, 1, 590)
            """
        );

        mockMvc.perform(delete("/api/admin/products/10/permanent")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("PRODUCT_HAS_ORDER_HISTORY"));

        assertThat(countRows("product", 10)).isEqualTo(1);
        assertThat(countRows("online_inventory", 10)).isEqualTo(1);
        assertThat(auditCount("PRODUCT_PERMANENT_DELETE")).isZero();
    }

    @Test
    void cashierCannotPermanentlyDeleteAnArchivedProduct() throws Exception {
        jdbcTemplate.update("update product set archived = true, on_shelf = false where id = 10");

        mockMvc.perform(delete("/api/admin/products/10/permanent")
                .header("Authorization", "Bearer " + cashierToken))
            .andExpect(status().isForbidden());

        assertThat(countRows("product", 10)).isEqualTo(1);
        assertThat(auditCount("PRODUCT_PERMANENT_DELETE")).isZero();
    }

    @Test
    void concurrentArchiveAndRestoreEachRecordExactlyOneAudit() throws Exception {
        runConcurrently(() -> catalogService.archive(10L, owner, "concurrent-archive"));
        assertThat(auditCount("PRODUCT_ARCHIVE")).isEqualTo(1);

        runConcurrently(() -> catalogService.restore(10L, owner, "concurrent-restore"));
        assertThat(auditCount("PRODUCT_RESTORE")).isEqualTo(1);
    }

    @Test
    void concurrentShelfCannotOverwriteACommittedArchive() throws Exception {
        jdbcTemplate.update("update product set on_shelf = false where id = 10");
        runCatalogWriteAgainstArchive(
            "shelf-writer",
            () -> catalogService.shelf(10L, true, owner, "concurrent-shelf")
        );

        assertArchivedOffShelfWithSingleAudit();
    }

    @Test
    void concurrentUpdateCannotOverwriteACommittedArchive() throws Exception {
        runCatalogWriteAgainstArchive(
            "update-writer",
            () -> catalogService.updateProduct(
                10L,
                new ProductWriteRequest(
                    "并发更新后的牛奶", 1L, 690, "盒", null, "并发更新", true, null
                ),
                owner,
                "concurrent-update"
            )
        );

        assertArchivedOffShelfWithSingleAudit();
    }

    private void runCatalogWriteAgainstArchive(
        String writerThread,
        java.util.concurrent.Callable<CatalogService.ProductView> writer
    ) throws Exception {
        var writerRead = new CountDownLatch(1);
        var archiveCommitted = new CountDownLatch(1);
        coordinateCatalogRead(writerThread, writerRead, archiveCommitted);
        var executor = Executors.newFixedThreadPool(2);
        try {
            Future<CatalogService.ProductView> writeFuture = executor.submit(() -> {
                Thread.currentThread().setName(writerThread);
                return writer.call();
            });
            assertThat(writerRead.await(5, TimeUnit.SECONDS)).isTrue();
            Future<CatalogService.ProductView> archiveFuture = executor.submit(() -> {
                Thread.currentThread().setName("archive-writer");
                return catalogService.archive(10L, owner, "concurrent-archive");
            });
            try {
                archiveFuture.get(10, TimeUnit.SECONDS);
            } finally {
                archiveCommitted.countDown();
            }
            writeFuture.get(10, TimeUnit.SECONDS);
        } finally {
            archiveCommitted.countDown();
            executor.shutdownNow();
        }
    }

    private void coordinateCatalogRead(
        String writerThread,
        CountDownLatch writerRead,
        CountDownLatch archiveCommitted
    ) {
        doAnswer(invocation -> {
            Object product = invocation.callRealMethod();
            if (writerThread.equals(Thread.currentThread().getName())) {
                writerRead.countDown();
                assertThat(archiveCommitted.await(10, TimeUnit.SECONDS)).isTrue();
            }
            return product;
        }).when(catalogRepository).product(anyLong());
        doAnswer(invocation -> {
            Object product = invocation.callRealMethod();
            if (writerThread.equals(Thread.currentThread().getName())) {
                writerRead.countDown();
            }
            return product;
        }).when(catalogRepository).productForUpdate(anyLong());
    }

    private void assertArchivedOffShelfWithSingleAudit() {
        Map<String, Object> state = jdbcTemplate.queryForMap(
            "select archived, on_shelf from product where id = 10"
        );
        assertThat(state.get("archived")).isEqualTo(true);
        assertThat(state.get("on_shelf")).isEqualTo(false);
        assertThat(auditCount("PRODUCT_ARCHIVE")).isEqualTo(1);
    }

    private void runConcurrently(java.util.concurrent.Callable<CatalogService.ProductView> operation)
        throws Exception {
        var executor = Executors.newFixedThreadPool(2);
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try {
            java.util.concurrent.Callable<CatalogService.ProductView> synchronizedStart = () -> {
                ready.countDown();
                assertThat(start.await(5, TimeUnit.SECONDS)).isTrue();
                return operation.call();
            };
            Future<CatalogService.ProductView> first = executor.submit(synchronizedStart);
            Future<CatalogService.ProductView> second = executor.submit(synchronizedStart);
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            first.get(10, TimeUnit.SECONDS);
            second.get(10, TimeUnit.SECONDS);
        } finally {
            executor.shutdownNow();
        }
    }

    private int auditCount(String action) {
        return jdbcTemplate.queryForObject(
            "select count(*) from operation_log where object_type = 'PRODUCT' and action = ?",
            Integer.class,
            action
        );
    }

    private int countRows(String table, long productId) {
        return jdbcTemplate.queryForObject(
            "select count(*) from " + table + " where "
                + ("product".equals(table) ? "id" : "product_id") + " = ?",
            Integer.class,
            productId
        );
    }
}
