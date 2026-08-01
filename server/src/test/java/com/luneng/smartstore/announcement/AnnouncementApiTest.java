package com.luneng.smartstore.announcement;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luneng.smartstore.auth.ActorType;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.support.IntegrationTestBase;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class AnnouncementApiTest extends IntegrationTestBase {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AnnouncementService service;

    private String ownerToken;
    private String cashierToken;

    @BeforeEach
    void setUp() throws Exception {
        jdbcTemplate.update("delete from operation_log");
        jdbcTemplate.update("delete from announcement");
        jdbcTemplate.update("delete from staff_account");
        insertStaff("announcement-owner", "OWNER");
        insertStaff("announcement-cashier", "CASHIER");
        ownerToken = login("announcement-owner");
        cashierToken = login("announcement-cashier");
    }

    @Test
    void ownerCanUseEveryAdminAnnouncementRoute() throws Exception {
        long id = createThroughApi();

        mockMvc.perform(get("/api/admin/announcements")
                .param("status", "DRAFT")
                .param("page", "0")
                .param("size", "20")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items[0].id").value(id));
        mockMvc.perform(get("/api/admin/announcements/{id}", id)
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.title").value("营业调整"));
        mockMvc.perform(put("/api/admin/announcements/{id}", id)
                .header("Authorization", "Bearer " + ownerToken)
                .contentType(APPLICATION_JSON)
                .content("""
                    {"title":"营业调整更新","content":"周日二十点闭店"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.title").value("营业调整更新"));
        mockMvc.perform(post("/api/admin/announcements/{id}/publish", id)
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("PUBLISHED"));
        mockMvc.perform(post("/api/admin/announcements/{id}/offline", id)
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("OFFLINE"));
        mockMvc.perform(delete("/api/admin/announcements/{id}", id)
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.deleted").value(true));
    }

    @Test
    void cashierReceivesForbiddenForEveryAdminAnnouncementRoute() throws Exception {
        long id = service.create(
            new AnnouncementWriteRequest("营业调整", "周日二十点闭店"), owner(), "setup-announcement"
        ).id();

        mockMvc.perform(get("/api/admin/announcements")
                .header("Authorization", "Bearer " + cashierToken))
            .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/admin/announcements")
                .header("Authorization", "Bearer " + cashierToken)
                .contentType(APPLICATION_JSON)
                .content("{\"title\":\"收银员公告\",\"content\":\"不应创建\"}"))
            .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/announcements/{id}", id)
                .header("Authorization", "Bearer " + cashierToken))
            .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/admin/announcements/{id}", id)
                .header("Authorization", "Bearer " + cashierToken)
                .contentType(APPLICATION_JSON)
                .content("{\"title\":\"收银员更新\",\"content\":\"不应更新\"}"))
            .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/admin/announcements/{id}/publish", id)
                .header("Authorization", "Bearer " + cashierToken))
            .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/admin/announcements/{id}/offline", id)
                .header("Authorization", "Bearer " + cashierToken))
            .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/admin/announcements/{id}", id)
                .header("Authorization", "Bearer " + cashierToken))
            .andExpect(status().isForbidden());
    }

    @Test
    void anonymousMiniRoutesExposeOnlyPublishedAnnouncements() throws Exception {
        AnnouncementView draft = service.create(
            new AnnouncementWriteRequest("草稿", "尚未发布"), owner(), "draft"
        );
        AnnouncementView published = service.create(
            new AnnouncementWriteRequest("营业调整", "周日二十点闭店"), owner(), "published"
        );
        service.publish(published.id(), owner(), "publish");
        AnnouncementView offline = service.create(
            new AnnouncementWriteRequest("历史公告", "已经下线"), owner(), "offline"
        );
        service.publish(offline.id(), owner(), "offline-publish");
        service.offline(offline.id(), owner(), "offline");

        mockMvc.perform(get("/api/mini/announcements/latest"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.id").value(published.id()))
            .andExpect(jsonPath("$.data.status").doesNotExist())
            .andExpect(jsonPath("$.data.createdBy").doesNotExist())
            .andExpect(jsonPath("$.data.updatedBy").doesNotExist())
            .andExpect(jsonPath("$.data.createdAt").doesNotExist())
            .andExpect(jsonPath("$.data.updatedAt").doesNotExist());
        mockMvc.perform(get("/api/mini/announcements")
                .param("page", "0").param("size", "20"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items.length()").value(1))
            .andExpect(jsonPath("$.data.items[0].id").value(published.id()))
            .andExpect(jsonPath("$.data.items[0].status").doesNotExist())
            .andExpect(jsonPath("$.data.items[0].createdBy").doesNotExist())
            .andExpect(jsonPath("$.data.items[0].updatedBy").doesNotExist())
            .andExpect(jsonPath("$.data.items[0].createdAt").doesNotExist())
            .andExpect(jsonPath("$.data.items[0].updatedAt").doesNotExist());
        mockMvc.perform(get("/api/mini/announcements/{id}", published.id()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.id").value(published.id()))
            .andExpect(jsonPath("$.data.status").doesNotExist())
            .andExpect(jsonPath("$.data.createdBy").doesNotExist())
            .andExpect(jsonPath("$.data.updatedBy").doesNotExist())
            .andExpect(jsonPath("$.data.createdAt").doesNotExist())
            .andExpect(jsonPath("$.data.updatedAt").doesNotExist());
        mockMvc.perform(get("/api/mini/announcements/{id}", draft.id()))
            .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/mini/announcements/{id}", offline.id()))
            .andExpect(status().isNotFound());
    }

    private long createThroughApi() throws Exception {
        String response = mockMvc.perform(post("/api/admin/announcements")
                .header("Authorization", "Bearer " + ownerToken)
                .header("X-Request-Id", "announcement-create-request")
                .contentType(APPLICATION_JSON)
                .content("""
                    {"title":"营业调整","content":"周日二十点闭店"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.requestId").value("announcement-create-request"))
            .andExpect(jsonPath("$.data.status").value("DRAFT"))
            .andReturn()
            .getResponse()
            .getContentAsString();
        return objectMapper.readTree(response).path("data").path("id").asLong();
    }

    private void insertStaff(String username, String role) {
        jdbcTemplate.update(
            "insert into staff_account(username, password_hash, role, enabled) values (?, ?, ?, true)",
            username, passwordEncoder.encode("password"), role
        );
    }

    private String login(String username) throws Exception {
        String response = mockMvc.perform(post("/api/admin/auth/login")
                .contentType(APPLICATION_JSON)
                .content("{\"username\":\"%s\",\"password\":\"password\"}".formatted(username)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
        JsonNode body = objectMapper.readTree(response);
        return body.path("data").path("accessToken").asText();
    }

    private CurrentPrincipal owner() {
        Long id = jdbcTemplate.queryForObject(
            "select id from staff_account where username = 'announcement-owner'", Long.class
        );
        return new CurrentPrincipal(id, ActorType.STAFF, "OWNER", "owner-session");
    }
}
