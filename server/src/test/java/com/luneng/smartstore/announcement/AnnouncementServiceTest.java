package com.luneng.smartstore.announcement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.luneng.smartstore.auth.ActorType;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.common.api.BusinessException;
import com.luneng.smartstore.support.IntegrationTestBase;
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
    void onlyOwnerCanMutateAnnouncements() {
        AnnouncementView created = create("营业调整", "周日20点闭店");

        assertThatThrownBy(() -> service.publish(created.id(), cashier, "cashier-publish"))
            .isInstanceOf(BusinessException.class);
        assertThat(service.detailAdmin(created.id()).status()).isEqualTo(AnnouncementStatus.DRAFT);
    }

    private AnnouncementView create(String title, String content) {
        return service.create(new AnnouncementWriteRequest(title, content), owner, "announcement-create");
    }
}
