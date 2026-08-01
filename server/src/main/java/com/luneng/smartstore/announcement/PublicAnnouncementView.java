package com.luneng.smartstore.announcement;

import java.time.Instant;

public record PublicAnnouncementView(
    long id,
    String title,
    String content,
    Instant publishedAt
) {
    static PublicAnnouncementView from(AnnouncementView announcement) {
        return new PublicAnnouncementView(
            announcement.id(),
            announcement.title(),
            announcement.content(),
            announcement.publishedAt()
        );
    }
}
