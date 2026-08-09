package com.luneng.smartstore.audit;

import com.luneng.smartstore.auth.CurrentPrincipal;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AuditService {
    private final OperationLogRepository repository;

    public AuditService(OperationLogRepository repository) {
        this.repository = repository;
    }

    public void record(
        CurrentPrincipal actor,
        String action,
        String objectType,
        String objectId,
        String summary,
        String requestId
    ) {
        repository.save(new OperationLog(
            actor.id(),
            actor.actorType().name(),
            action,
            objectType,
            objectId,
            sanitize(summary),
            requestId
        ));
    }

    public boolean wasRecorded(
        CurrentPrincipal actor,
        String action,
        String objectType,
        String objectId,
        String requestId
    ) {
        return repository.existsByActorIdAndActionAndObjectTypeAndObjectIdAndRequestId(
            actor.id(), action, objectType, objectId, requestId
        );
    }

    @Transactional(readOnly = true)
    public AuditPage list(
        Long actorId,
        String action,
        String objectType,
        int page,
        int size
    ) {
        Specification<OperationLog> specification = Specification.where(null);
        if (actorId != null) {
            specification = specification.and(
                (root, query, builder) -> builder.equal(root.get("actorId"), actorId)
            );
        }
        if (StringUtils.hasText(action)) {
            specification = specification.and(
                (root, query, builder) -> builder.equal(root.get("action"), action.trim())
            );
        }
        if (StringUtils.hasText(objectType)) {
            specification = specification.and(
                (root, query, builder) -> builder.equal(root.get("objectType"), objectType.trim())
            );
        }
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        var result = repository.findAll(
            specification,
            PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt"))
        );
        return new AuditPage(
            result.getContent().stream().map(AuditView::from).toList(),
            result.getTotalElements(),
            safePage,
            safeSize
        );
    }

    private String sanitize(String summary) {
        String value = summary == null ? "" : summary;
        return value.length() <= 500 ? value : value.substring(0, 500);
    }

    public record AuditPage(List<AuditView> items, long total, int page, int size) {
    }

    public record AuditView(
        long actorId,
        String actorType,
        String action,
        String objectType,
        String objectId,
        String resultSummary,
        String requestId,
        Instant createdAt
    ) {
        static AuditView from(OperationLog log) {
            return new AuditView(
                log.getActorId(),
                log.getActorType(),
                log.getAction(),
                log.getObjectType(),
                log.getObjectId(),
                log.getResultSummary(),
                log.getRequestId(),
                log.getCreatedAt()
            );
        }
    }
}
