package com.luneng.smartstore.announcement;

import com.luneng.smartstore.audit.AuditService;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.common.api.BusinessException;
import jakarta.persistence.EntityNotFoundException;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnnouncementService {
    private static final String OBJECT_TYPE = "ANNOUNCEMENT";
    private final AnnouncementRepository repository;
    private final AuditService auditService;

    public AnnouncementService(AnnouncementRepository repository, AuditService auditService) {
        this.repository = repository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public Page<AnnouncementView> listAdmin(
        AnnouncementStatus status,
        int page,
        int size,
        CurrentPrincipal actor
    ) {
        requireOwner(actor);
        var pageable = PageRequest.of(
            Math.max(page, 0),
            Math.min(Math.max(size, 1), 100),
            Sort.by(Sort.Direction.DESC, "createdAt")
        );
        Page<Announcement> result = status == null
            ? repository.findAll(pageable)
            : repository.findAllByStatus(status, pageable);
        return result.map(AnnouncementView::from);
    }

    @Transactional(readOnly = true)
    public AnnouncementView detailAdmin(long id, CurrentPrincipal actor) {
        requireOwner(actor);
        return AnnouncementView.from(find(id));
    }

    @Transactional
    public AnnouncementView create(
        AnnouncementWriteRequest request,
        CurrentPrincipal actor,
        String requestId
    ) {
        requireOwner(actor);
        Content content = normalize(request);
        Announcement announcement = repository.save(new Announcement(content.title(), content.content(), actor.id()));
        audit(actor, "ANNOUNCEMENT_CREATE", announcement, announcement.getTitle(), requestId);
        return AnnouncementView.from(announcement);
    }

    @Transactional
    public AnnouncementView update(
        long id,
        AnnouncementWriteRequest request,
        CurrentPrincipal actor,
        String requestId
    ) {
        requireOwner(actor);
        Content content = normalize(request);
        Announcement announcement = find(id);
        announcement.updateContent(content.title(), content.content(), actor.id());
        audit(actor, "ANNOUNCEMENT_UPDATE", announcement, announcement.getTitle(), requestId);
        return AnnouncementView.from(announcement);
    }

    @Transactional
    public AnnouncementView publish(long id, CurrentPrincipal actor, String requestId) {
        requireOwner(actor);
        Announcement announcement = find(id);
        if (announcement.publish(actor.id())) {
            audit(actor, "ANNOUNCEMENT_PUBLISH", announcement, announcement.getTitle(), requestId);
        }
        return AnnouncementView.from(announcement);
    }

    @Transactional
    public AnnouncementView offline(long id, CurrentPrincipal actor, String requestId) {
        requireOwner(actor);
        Announcement announcement = find(id);
        if (announcement.offline(actor.id())) {
            audit(actor, "ANNOUNCEMENT_OFFLINE", announcement, announcement.getTitle(), requestId);
        }
        return AnnouncementView.from(announcement);
    }

    @Transactional
    public boolean delete(long id, CurrentPrincipal actor, String requestId) {
        requireOwner(actor);
        Announcement announcement = find(id);
        announcement.rejectPublishedChange();
        repository.delete(announcement);
        audit(actor, "ANNOUNCEMENT_DELETE", announcement, announcement.getTitle(), requestId);
        return true;
    }

    @Transactional(readOnly = true)
    public Optional<AnnouncementView> latestPublished() {
        return repository.findFirstByStatusOrderByPublishedAtDesc(AnnouncementStatus.PUBLISHED)
            .map(AnnouncementView::from);
    }

    @Transactional(readOnly = true)
    public Page<AnnouncementView> listPublished(int page, int size) {
        return repository.findAllByStatusOrderByPublishedAtDesc(
            AnnouncementStatus.PUBLISHED,
            PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100))
        ).map(AnnouncementView::from);
    }

    @Transactional(readOnly = true)
    public AnnouncementView detailPublished(long id) {
        Announcement announcement = find(id);
        if (announcement.getStatus() != AnnouncementStatus.PUBLISHED) {
            throw new EntityNotFoundException();
        }
        return AnnouncementView.from(announcement);
    }

    private Announcement find(long id) {
        return repository.findById(id).orElseThrow(EntityNotFoundException::new);
    }

    private Content normalize(AnnouncementWriteRequest request) {
        String title = request.title() == null ? "" : request.title().trim();
        String content = request.content() == null ? "" : request.content().trim();
        if (title.isEmpty() || content.isEmpty() || title.length() > 60 || content.length() > 2000) {
            throw new BusinessException(
                "VALIDATION_ERROR",
                "公告标题不能为空且不超过60字，正文不能为空且不超过2000字",
                HttpStatus.BAD_REQUEST
            );
        }
        return new Content(title, content);
    }

    private void requireOwner(CurrentPrincipal actor) {
        if (actor == null || !"OWNER".equals(actor.role())) {
            throw new BusinessException("FORBIDDEN", "仅店主可操作公告", HttpStatus.FORBIDDEN);
        }
    }

    private void audit(
        CurrentPrincipal actor,
        String action,
        Announcement announcement,
        String summary,
        String requestId
    ) {
        auditService.record(
            actor,
            action,
            OBJECT_TYPE,
            Long.toString(announcement.getId()),
            summary,
            requestId
        );
    }

    private record Content(String title, String content) {
    }
}
