package com.luneng.smartstore.announcement;

import com.luneng.smartstore.common.api.BusinessException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "announcement")
public class Announcement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 60)
    private String title;

    @Column(nullable = false, length = 2000)
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private AnnouncementStatus status;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "created_by", nullable = false)
    private long createdBy;

    @Column(name = "updated_by", nullable = false)
    private long updatedBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    protected Announcement() {
    }

    public Announcement(String title, String content, long actorId) {
        this.title = title;
        this.content = content;
        this.status = AnnouncementStatus.DRAFT;
        this.createdBy = actorId;
        this.updatedBy = actorId;
    }

    public void updateContent(String title, String content, long actorId) {
        rejectPublishedChange();
        this.title = title;
        this.content = content;
        this.updatedBy = actorId;
    }

    public boolean publish(long actorId) {
        if (status == AnnouncementStatus.PUBLISHED) {
            return false;
        }
        status = AnnouncementStatus.PUBLISHED;
        publishedAt = Instant.now();
        updatedBy = actorId;
        return true;
    }

    public boolean offline(long actorId) {
        if (status == AnnouncementStatus.OFFLINE) {
            return false;
        }
        if (status != AnnouncementStatus.PUBLISHED) {
            throw conflict("只有已发布公告可以下线");
        }
        status = AnnouncementStatus.OFFLINE;
        updatedBy = actorId;
        return true;
    }

    public void rejectPublishedChange() {
        if (status == AnnouncementStatus.PUBLISHED) {
            throw conflict("已发布公告请先下线后再编辑或删除");
        }
    }

    private BusinessException conflict(String message) {
        return new BusinessException("ANNOUNCEMENT_STATE_CONFLICT", message);
    }

    public Long getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getContent() {
        return content;
    }

    public AnnouncementStatus getStatus() {
        return status;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public long getCreatedBy() {
        return createdBy;
    }

    public long getUpdatedBy() {
        return updatedBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
