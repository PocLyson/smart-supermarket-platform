package com.luneng.smartstore.audit;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luneng.smartstore.support.IntegrationTestBase;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class AdminAuditControllerTest extends IntegrationTestBase {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        jdbcTemplate.update("delete from operation_log");
        jdbcTemplate.update("delete from staff_account");
        jdbcTemplate.update(
            """
            insert into staff_account(id, username, password_hash, role, enabled)
            values (1, 'owner', ?, 'OWNER', true)
            """,
            passwordEncoder.encode("owner-password")
        );
        jdbcTemplate.update(
            """
            insert into operation_log(
                actor_id, actor_type, action, object_type, object_id, result_summary, request_id
            ) values (1, 'STAFF', 'ORDER_ACCEPT', 'ORDER', 'ORD-1', 'accepted', 'req-audit')
            """
        );
    }

    @Test
    void ownerCanFilterAuditLogsWithoutSensitiveFields() throws Exception {
        String token = login();

        mockMvc.perform(get("/api/admin/audit-logs")
                .param("actorId", "1")
                .param("action", "ORDER_ACCEPT")
                .param("objectType", "ORDER")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items[0].actorId").value(1))
            .andExpect(jsonPath("$.data.items[0].action").value("ORDER_ACCEPT"))
            .andExpect(jsonPath("$.data.items[0].requestId").value("req-audit"))
            .andExpect(content().string(org.hamcrest.Matchers.not(
                org.hamcrest.Matchers.containsString("password_hash")
            )))
            .andExpect(content().string(org.hamcrest.Matchers.not(
                org.hamcrest.Matchers.containsString("accessToken")
            )));
    }

    private String login() throws Exception {
        String response = mockMvc.perform(post("/api/admin/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"username":"owner","password":"owner-password"}
                    """))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
        JsonNode body = objectMapper.readTree(response);
        return body.path("data").path("accessToken").asText();
    }
}
