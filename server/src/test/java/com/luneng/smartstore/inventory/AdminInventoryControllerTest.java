package com.luneng.smartstore.inventory;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luneng.smartstore.support.IntegrationTestBase;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@AutoConfigureMockMvc
class AdminInventoryControllerTest extends IntegrationTestBase {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    private String ownerToken;

    @BeforeEach
    void setUp() throws Exception {
        jdbcTemplate.update("delete from inventory_ledger");
        jdbcTemplate.update("delete from online_inventory");
        jdbcTemplate.update("delete from product");
        jdbcTemplate.update("delete from category");
        jdbcTemplate.update("delete from staff_account");
        jdbcTemplate.update(
            "insert into staff_account(username, password_hash, role, enabled) values (?, ?, 'OWNER', true)",
            "inventory-owner",
            passwordEncoder.encode("owner-password")
        );
        jdbcTemplate.update(
            "insert into category(id, name, sort_order, enabled) values (1, '乳品饮料', 1, true)"
        );
        jdbcTemplate.update(
            "insert into category(id, name, sort_order, enabled) values (2, '休闲零食', 2, true)"
        );
        jdbcTemplate.update(
            """
            insert into product(id, category_id, name, price_cent, unit, on_shelf)
            values (10, 1, '纯牛奶', 590, '盒', true)
            """
        );
        jdbcTemplate.update(
            """
            insert into product(id, category_id, name, price_cent, unit, on_shelf)
            values (11, 1, '新到酸奶', 690, '杯', false)
            """
        );
        jdbcTemplate.update(
            """
            insert into product(id, category_id, name, price_cent, unit, on_shelf)
            values (12, 2, '薯片', 490, '袋', true)
            """
        );
        jdbcTemplate.update(
            "insert into online_inventory(product_id, available_quantity, version) values (10, 8, 0)"
        );
        jdbcTemplate.update(
            "insert into online_inventory(product_id, available_quantity, version) values (12, 3, 0)"
        );
        ownerToken = login();
    }

    @Test
    void listReturnsProductDetailsAndCurrentQuantity() throws Exception {
        mockMvc.perform(get("/api/admin/inventory")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items[0].productId").value(10))
            .andExpect(jsonPath("$.data.items[0].productName").value("纯牛奶"))
            .andExpect(jsonPath("$.data.items[0].availableQuantity").value(8))
            .andExpect(jsonPath("$.data.items[0].unit").value("盒"))
            .andExpect(jsonPath("$.data.items[0].updatedAt").isNotEmpty())
            .andExpect(jsonPath("$.data.items[1].productId").value(11))
            .andExpect(jsonPath("$.data.items[1].availableQuantity").value(0))
            .andExpect(jsonPath("$.data.total").value(3));
    }

    @Test
    void listFiltersByCategoryAndOutOfStockStatus() throws Exception {
        mockMvc.perform(get("/api/admin/inventory")
                .param("categoryId", "1")
                .param("stockStatus", "OUT_OF_STOCK")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items.length()").value(1))
            .andExpect(jsonPath("$.data.items[0].productId").value(11))
            .andExpect(jsonPath("$.data.items[0].categoryId").value(1))
            .andExpect(jsonPath("$.data.items[0].availableQuantity").value(0))
            .andExpect(jsonPath("$.data.total").value(1));
    }

    @Test
    void listFiltersLowStockProducts() throws Exception {
        mockMvc.perform(get("/api/admin/inventory")
                .param("stockStatus", "LOW_STOCK")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items.length()").value(1))
            .andExpect(jsonPath("$.data.items[0].productId").value(12))
            .andExpect(jsonPath("$.data.items[0].availableQuantity").value(3))
            .andExpect(jsonPath("$.data.total").value(1));
    }

    @Test
    void adjustmentReturnsUpdatedInventoryItem() throws Exception {
        mockMvc.perform(post("/api/admin/inventory/10/adjustments")
                .header("Authorization", "Bearer " + ownerToken)
                .contentType(APPLICATION_JSON)
                .content("""
                    {"delta":5,"reason":"到货补充"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.productId").value(10))
            .andExpect(jsonPath("$.data.productName").value("纯牛奶"))
            .andExpect(jsonPath("$.data.availableQuantity").value(13))
            .andExpect(jsonPath("$.data.unit").value("盒"));
    }

    private String login() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/admin/auth/login")
                .contentType(APPLICATION_JSON)
                .content("""
                    {"username":"inventory-owner","password":"owner-password"}
                    """))
            .andExpect(status().isOk())
            .andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.path("data").path("accessToken").asText();
    }
}
