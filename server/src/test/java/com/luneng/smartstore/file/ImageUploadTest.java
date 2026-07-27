package com.luneng.smartstore.file;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luneng.smartstore.support.IntegrationTestBase;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class ImageUploadTest extends IntegrationTestBase {
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
        jdbcTemplate.update("delete from staff_account");
        jdbcTemplate.update(
            """
            insert into staff_account(id, username, password_hash, role, enabled)
            values (1, 'owner', ?, 'OWNER', true)
            """,
            passwordEncoder.encode("owner-password")
        );
        ownerToken = login();
    }

    @Test
    void rejectsExecutableDisguisedAsImage() throws Exception {
        var file = new MockMultipartFile(
            "file", "bad.jpg", "image/jpeg", "MZ executable".getBytes(UTF_8)
        );

        mockMvc.perform(multipart("/api/admin/files/images")
                .file(file)
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_IMAGE"));
    }

    @Test
    void rejectsImageLargerThanFiveMebibytes() throws Exception {
        var file = new MockMultipartFile(
            "file",
            "large.png",
            "image/png",
            new byte[5 * 1024 * 1024 + 1]
        );

        mockMvc.perform(multipart("/api/admin/files/images")
                .file(file)
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_IMAGE"));
    }

    @Test
    void storesDecodedImageUnderGeneratedPublicName() throws Exception {
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 3, BufferedImage.TYPE_INT_RGB), "png", bytes);
        var file = new MockMultipartFile(
            "file", "../../unsafe.png", "image/png", bytes.toByteArray()
        );

        String response = mockMvc.perform(multipart("/api/admin/files/images")
                .file(file)
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.width").value(2))
            .andExpect(jsonPath("$.data.height").value(3))
            .andExpect(jsonPath("$.data.url").value(
                org.hamcrest.Matchers.matchesPattern("^/files/[0-9a-f-]+\\.png$")
            ))
            .andReturn()
            .getResponse()
            .getContentAsString();

        String url = objectMapper.readTree(response).path("data").path("url").asText();
        mockMvc.perform(get(url))
            .andExpect(status().isOk())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                .content().contentType("image/png"));
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
