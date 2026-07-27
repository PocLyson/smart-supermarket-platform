package com.luneng.smartstore;

import com.luneng.smartstore.staff.StaffAccountRepository;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(properties = {
    "spring.autoconfigure.exclude="
        + "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,"
        + "org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration,"
        + "org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration",
    "smart-store.jwt.secret=test-only-secret-with-at-least-32-bytes"
})
class SmartStoreApplicationTest {
    @MockitoBean
    private StaffAccountRepository staffAccountRepository;

    @MockitoBean
    private StringRedisTemplate redisTemplate;

    @Test
    void contextLoads() {
    }
}
