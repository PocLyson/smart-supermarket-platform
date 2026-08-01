package com.luneng.smartstore.support;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.annotation.DirtiesContext;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers
@SpringBootTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public abstract class IntegrationTestBase {
    @Container
    protected static final MySQLContainer<?> MYSQL =
        new MySQLContainer<>(DockerImageName.parse("mysql:8.4"));

    @Container
    protected static final GenericContainer<?> REDIS =
        new GenericContainer<>(DockerImageName.parse("redis:7.4-alpine"))
            .withExposedPorts(6379);

    @DynamicPropertySource
    static void registerInfrastructure(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.data.redis.host", REDIS::getHost);
        registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
        registry.add("smart-store.jwt.secret",
            () -> "test-only-secret-with-at-least-32-bytes");
        registry.add("smart-store.wechat.app-id", () -> "test-app-id");
        registry.add("smart-store.wechat.app-secret", () -> "test-app-secret");
        registry.add("smart-store.store-contact.phone", () -> "18653045492");
        registry.add("smart-store.store-contact.customer-service-enabled", () -> true);
        registry.add("smart-store.upload-dir",
            () -> System.getProperty("java.io.tmpdir") + "/smart-store-test-uploads");
    }
}
