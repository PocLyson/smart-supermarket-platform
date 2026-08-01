package com.luneng.smartstore.announcement;

import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {
    Page<Announcement> findAllByStatus(AnnouncementStatus status, Pageable pageable);

    Page<Announcement> findAllByStatusOrderByPublishedAtDesc(
        AnnouncementStatus status,
        Pageable pageable
    );

    Optional<Announcement> findFirstByStatusOrderByPublishedAtDesc(AnnouncementStatus status);
}
