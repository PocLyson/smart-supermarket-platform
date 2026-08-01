package com.luneng.smartstore;

import com.luneng.smartstore.announcement.AnnouncementRepository;
import com.luneng.smartstore.audit.AuditService;
import com.luneng.smartstore.catalog.CatalogService;
import com.luneng.smartstore.catalog.CatalogRepository;
import com.luneng.smartstore.customer.CustomerAuthService;
import com.luneng.smartstore.customer.CustomerUserRepository;
import com.luneng.smartstore.inventory.InventoryService;
import com.luneng.smartstore.inventory.InventoryRepository;
import com.luneng.smartstore.order.AdminOrderService;
import com.luneng.smartstore.order.OrderApplicationService;
import com.luneng.smartstore.order.OrderRepository;
import com.luneng.smartstore.staff.StaffAccountRepository;
import com.luneng.smartstore.staff.StaffManagementService;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(properties = {
    "spring.autoconfigure.exclude="
        + "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,"
        + "org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration,"
        + "org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration",
    "smart-store.jwt.secret=test-only-secret-with-at-least-32-bytes",
    "smart-store.wechat.app-id=test-app-id",
    "smart-store.wechat.app-secret=test-app-secret",
    "smart-store.upload-dir=target/test-uploads"
})
class SmartStoreApplicationTest {
    @MockitoBean
    private AnnouncementRepository announcementRepository;

    @MockitoBean
    private StaffAccountRepository staffAccountRepository;

    @MockitoBean
    private StringRedisTemplate redisTemplate;

    @MockitoBean
    private AuditService auditService;

    @MockitoBean
    private CatalogService catalogService;

    @MockitoBean
    private CatalogRepository catalogRepository;

    @MockitoBean
    private InventoryService inventoryService;

    @MockitoBean
    private InventoryRepository inventoryRepository;

    @MockitoBean
    private CustomerAuthService customerAuthService;

    @MockitoBean
    private CustomerUserRepository customerUserRepository;

    @MockitoBean
    private OrderApplicationService orderApplicationService;

    @MockitoBean
    private OrderRepository orderRepository;

    @MockitoBean
    private AdminOrderService adminOrderService;

    @MockitoBean
    private StaffManagementService staffManagementService;

    @Test
    void contextLoads() {
    }
}
