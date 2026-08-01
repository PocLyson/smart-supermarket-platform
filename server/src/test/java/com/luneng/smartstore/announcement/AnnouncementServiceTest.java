package com.luneng.smartstore.announcement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.luneng.smartstore.auth.ActorType;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.common.api.BusinessException;
import com.luneng.smartstore.support.IntegrationTestBase;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.jdbc.core.JdbcTemplate;

class AnnouncementServiceTest extends IntegrationTestBase {
    private final CurrentPrincipal owner =
        new CurrentPrincipal(1L, ActorType.STAFF, "OWNER", "owner-session");
    private final CurrentPrincipal cashier =
        new CurrentPrincipal(2L, ActorType.STAFF, "CASHIER", "cashier-session");

    @Autowired
    private AnnouncementService service;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void cleanUp() {
        jdbcTemplate.update("delete from operation_log");
        jdbcTemplate.update("delete from announcement");
    }

    @Test
    void publishedAnnouncementMustBeOfflineBeforeEditingOrDeleting() {
        AnnouncementView created = create("营业调整", "周日20点闭店");
        service.publish(created.id(), owner, "announcement-publish");

        assertThatThrownBy(() -> service.update(
            created.id(), new AnnouncementWriteRequest("新标题", "新正文"), owner,
            "announcement-update"
        )).isInstanceOf(BusinessException.class)
            .hasMessageContaining("请先下线");
        assertThatThrownBy(() -> service.delete(created.id(), owner, "announcement-delete"))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("请先下线");
    }

    @Test
    void publishAndOfflineAreIdempotentWithoutDuplicateAuditRecords() {
        long id = create("今日营业", "晚上十点闭店").id();

        service.publish(id, owner, "publish-1");
        service.publish(id, owner, "publish-2");
        service.offline(id, owner, "offline-1");
        service.offline(id, owner, "offline-2");

        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from operation_log where object_type = 'ANNOUNCEMENT'",
            Integer.class
        )).isEqualTo(3);
    }

    @Test
    void concurrentPublishAndOfflineEachRecordExactlyOneStateChange() throws Exception {
        long id = create("Concurrent", "Only one audit per transition").id();

        runConcurrently(() -> service.publish(id, owner, "concurrent-publish"));
        assertThat(auditCount("ANNOUNCEMENT_PUBLISH")).isEqualTo(1);

        runConcurrently(() -> service.offline(id, owner, "concurrent-offline"));
        assertThat(auditCount("ANNOUNCEMENT_OFFLINE")).isEqualTo(1);
    }

    @Test
    void blankTitleOrContentAndOverlongValuesAreRejectedAfterTrimming() {
        assertThatThrownBy(() -> create("   ", "正文"))
            .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> create("标题", "\t\n"))
            .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> create("x".repeat(61), "正文"))
            .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> create("标题", "x".repeat(2001)))
            .isInstanceOf(BusinessException.class);
    }

    @Test
    void createAndOfflineUpdateTrimPlainTextContentAndAuditChanges() {
        AnnouncementView created = create("  营业调整  ", "  周日20点闭店  ");
        service.publish(created.id(), owner, "publish");
        service.offline(created.id(), owner, "offline");

        AnnouncementView updated = service.update(
            created.id(), new AnnouncementWriteRequest("  新标题  ", "  新正文  "), owner, "update"
        );

        assertThat(updated.title()).isEqualTo("新标题");
        assertThat(updated.content()).isEqualTo("新正文");
        assertThat(updated.status()).isEqualTo(AnnouncementStatus.OFFLINE);
        assertThat(created.createdAt()).isNotNull();
        assertThat(created.updatedAt()).isNotNull();
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from operation_log where object_type = 'ANNOUNCEMENT'",
            Integer.class
        )).isEqualTo(4);
    }

    @Test
    void publishedQueriesExcludeDraftAndOfflineAndUseNewestPublicationFirst() throws Exception {
        AnnouncementView draft = create("草稿", "尚未发布");
        AnnouncementView first = create("第一条", "先发布");
        service.publish(first.id(), owner, "publish-first");
        Thread.sleep(5);
        AnnouncementView newest = create("第二条", "后发布");
        service.publish(newest.id(), owner, "publish-newest");
        AnnouncementView offline = create("第三条", "已结束");
        service.publish(offline.id(), owner, "publish-offline");
        service.offline(offline.id(), owner, "offline-third");

        Page<AnnouncementView> published = service.listPublished(0, 20);

        assertThat(published.getContent()).extracting(AnnouncementView::id)
            .containsExactly(newest.id(), first.id());
        assertThat(service.latestPublished().orElseThrow().id()).isEqualTo(newest.id());
        assertThatThrownBy(() -> service.detailPublished(draft.id()))
            .isInstanceOf(jakarta.persistence.EntityNotFoundException.class);
        assertThatThrownBy(() -> service.detailPublished(offline.id()))
            .isInstanceOf(jakarta.persistence.EntityNotFoundException.class);
    }

    @Test
    void publishedQueriesUseDescendingIdAsAStableTieBreaker() {
        AnnouncementView first = create("First", "Published first");
        service.publish(first.id(), owner, "publish-first");
        AnnouncementView second = create("Second", "Published second");
        service.publish(second.id(), owner, "publish-second");
        jdbcTemplate.update(
            "update announcement set published_at = ? where id in (?, ?)",
            java.sql.Timestamp.from(java.time.Instant.parse("2026-08-01T12:00:00Z")),
            first.id(),
            second.id()
        );

        assertThat(service.listPublished(0, 20).getContent())
            .extracting(AnnouncementView::id)
            .containsExactly(second.id(), first.id());
        assertThat(service.latestPublished().orElseThrow().id()).isEqualTo(second.id());
    }

    @Test
    void onlyOwnerCanUseEveryAdminAnnouncementOperation() {
        AnnouncementView created = create("营业调整", "周日20点闭店");

        assertOwnerOnly(() -> service.listAdmin(null, 0, 20, cashier));
        assertOwnerOnly(() -> service.detailAdmin(created.id(), cashier));
        assertOwnerOnly(() -> service.create(
            new AnnouncementWriteRequest("收银员公告", "不应创建"), cashier, "cashier-create"
        ));
        assertOwnerOnly(() -> service.update(
            created.id(), new AnnouncementWriteRequest("收银员标题", "不应更新"), cashier,
            "cashier-update"
        ));
        assertThatThrownBy(() -> service.publish(created.id(), cashier, "cashier-publish"))
            .isInstanceOf(BusinessException.class);
        assertOwnerOnly(() -> service.offline(created.id(), cashier, "cashier-offline"));
        assertOwnerOnly(() -> service.delete(created.id(), cashier, "cashier-delete"));
        assertThat(service.detailAdmin(created.id(), owner).status()).isEqualTo(AnnouncementStatus.DRAFT);
    }

    private AnnouncementView create(String title, String content) {
        return service.create(new AnnouncementWriteRequest(title, content), owner, "announcement-create");
    }

    private void runConcurrently(java.util.concurrent.Callable<AnnouncementView> operation)
        throws Exception {
        var executor = Executors.newFixedThreadPool(2);
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try {
            java.util.concurrent.Callable<AnnouncementView> synchronizedStart = () -> {
                ready.countDown();
                assertThat(start.await(5, TimeUnit.SECONDS)).isTrue();
                return operation.call();
            };
            Future<AnnouncementView> first = executor.submit(synchronizedStart);
            Future<AnnouncementView> second = executor.submit(synchronizedStart);
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            first.get(10, TimeUnit.SECONDS);
            second.get(10, TimeUnit.SECONDS);
        } finally {
            executor.shutdownNow();
        }
    }

    private int auditCount(String action) {
        return jdbcTemplate.queryForObject(
            "select count(*) from operation_log where object_type = 'ANNOUNCEMENT' and action = ?",
            Integer.class,
            action
        );
    }

    private void assertOwnerOnly(org.assertj.core.api.ThrowableAssert.ThrowingCallable operation) {
        assertThatThrownBy(operation)
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("仅店主");
    }
}
