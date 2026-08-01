package com.luneng.smartstore.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.luneng.smartstore.support.IntegrationTestBase;
import com.luneng.smartstore.auth.ActorType;
import com.luneng.smartstore.auth.CurrentPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class CatalogApiTest extends IntegrationTestBase {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private CatalogService catalogService;

    @BeforeEach
    void setUpCatalog() {
        jdbcTemplate.update("delete from operation_log");
        jdbcTemplate.update("delete from inventory_ledger");
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
}
