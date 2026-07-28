package com.luneng.smartstore.staff;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luneng.smartstore.common.api.ApiResponse;
import com.luneng.smartstore.support.IntegrationTestBase;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@AutoConfigureMockMvc
@Import(StaffAuthControllerTest.SecurityTestController.class)
class StaffAuthControllerTest extends IntegrationTestBase {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUpAccounts() {
        jdbcTemplate.update("delete from staff_account");
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        insert("owner", encoder.encode("correct-password"), "OWNER");
        insert("cashier", encoder.encode("cashier-password"), "CASHIER");
    }

    @Test
    void ownerCanLoginAndReceivesOwnerRole() throws Exception {
        mockMvc.perform(post("/api/admin/auth/login")
                .contentType(APPLICATION_JSON)
                .content("""
                    {"username":"owner","password":"correct-password"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.role").value("OWNER"))
            .andExpect(jsonPath("$.data.staffId").isNumber())
            .andExpect(jsonPath("$.data.username").value("owner"))
            .andExpect(jsonPath("$.data.accessToken").isNotEmpty());
    }

    @Test
    void cashierCannotCallOwnerOnlyEndpoint() throws Exception {
        String token = login("cashier", "cashier-password");

        mockMvc.perform(get("/api/admin/security-test/owner-only")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    private String login(String username, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/admin/auth/login")
                .contentType(APPLICATION_JSON)
                .content("""
                    {"username":"%s","password":"%s"}
                    """.formatted(username, password)))
            .andExpect(status().isOk())
            .andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.path("data").path("accessToken").asText();
    }

    private void insert(String username, String hash, String role) {
        jdbcTemplate.update(
            "insert into staff_account(username, password_hash, role, enabled) values (?, ?, ?, true)",
            username, hash, role
        );
    }

    @RestController
    public static class SecurityTestController {
        @GetMapping("/api/admin/security-test/owner-only")
        ApiResponse<String> ownerOnly() {
            return ApiResponse.success("test", "owner");
        }
    }
}
