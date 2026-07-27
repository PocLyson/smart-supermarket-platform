package com.luneng.smartstore.catalog;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.luneng.smartstore.support.IntegrationTestBase;
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

    @BeforeEach
    void setUpCatalog() {
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
    }

    @Test
    void miniCatalogReturnsOnlyEnabledCategoriesAndOnShelfProducts() throws Exception {
        mockMvc.perform(get("/api/mini/products").param("keyword", "牛奶"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items[0].name").value("纯牛奶"))
            .andExpect(jsonPath("$.data.items[0].priceCent").value(590));
    }
}
