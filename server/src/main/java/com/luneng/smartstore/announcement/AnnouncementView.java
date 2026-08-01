package com.luneng.smartstore.announcement;

import java.time.Instant;

public record AnnouncementView(
    long id,
    String title,
    String content,
    AnnouncementStatus status,
    Instant publishedAt,
    long createdBy,
    long updatedBy,
    Instant createdAt,
    Instant updatedAt
) {
    static AnnouncementView from(Announcement announcement) {
        return new AnnouncementView(
            announcement.getId(),
            announcement.getTitle(),
            announcement.getContent(),
            announcement.getStatus(),
            announcement.getPublishedAt(),
            announcement.getCreatedBy(),
            announcement.getUpdatedBy(),
            announcement.getCreatedAt(),
            announcement.getUpdatedAt()
        );
    }
}
