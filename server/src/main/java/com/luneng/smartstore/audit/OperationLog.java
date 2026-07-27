package com.luneng.smartstore.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "operation_log")
public class OperationLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "actor_id", nullable = false)
    private long actorId;

    @Column(name = "actor_type", nullable = false, length = 32)
    private String actorType;

    @Column(nullable = false, length = 80)
    private String action;

    @Column(name = "object_type", nullable = false, length = 80)
    private String objectType;

    @Column(name = "object_id", nullable = false, length = 128)
    private String objectId;

    @Column(name = "result_summary", nullable = false, length = 500)
    private String resultSummary;

    @Column(name = "request_id", nullable = false, length = 128)
    private String requestId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    protected OperationLog() {
    }

    public OperationLog(
        long actorId,
        String actorType,
        String action,
        String objectType,
        String objectId,
        String resultSummary,
        String requestId
    ) {
        this.actorId = actorId;
        this.actorType = actorType;
        this.action = action;
        this.objectType = objectType;
        this.objectId = objectId;
        this.resultSummary = resultSummary;
        this.requestId = requestId;
    }

    public long getActorId() {
        return actorId;
    }

    public String getActorType() {
        return actorType;
    }

    public String getAction() {
        return action;
    }

    public String getObjectType() {
        return objectType;
    }

    public String getObjectId() {
        return objectId;
    }

    public String getResultSummary() {
        return resultSummary;
    }

    public String getRequestId() {
        return requestId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
