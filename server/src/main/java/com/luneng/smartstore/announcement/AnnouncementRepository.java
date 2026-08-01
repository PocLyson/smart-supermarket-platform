package com.luneng.smartstore.announcement;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select announcement from Announcement announcement where announcement.id = :id")
    Optional<Announcement> findByIdForUpdate(@Param("id") long id);

    Page<Announcement> findAllByStatus(AnnouncementStatus status, Pageable pageable);

    Page<Announcement> findAllByStatusOrderByPublishedAtDescIdDesc(
        AnnouncementStatus status,
        Pageable pageable
    );

    Optional<Announcement> findFirstByStatusOrderByPublishedAtDescIdDesc(AnnouncementStatus status);
}
