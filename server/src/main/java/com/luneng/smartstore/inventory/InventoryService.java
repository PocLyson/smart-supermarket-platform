package com.luneng.smartstore.inventory;

import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.audit.AuditService;
import com.luneng.smartstore.common.api.BusinessException;
import jakarta.persistence.EntityNotFoundException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InventoryService {
    private final InventoryRepository repository;
    private final AuditService auditService;

    public InventoryService(InventoryRepository repository, AuditService auditService) {
        this.repository = repository;
        this.auditService = auditService;
    }

    @Transactional
    public void adjust(long productId, int delta, String reason, CurrentPrincipal actor) {
        adjust(productId, delta, reason, actor, "internal");
    }

    @Transactional
    public void adjust(
        long productId,
        int delta,
        String reason,
        CurrentPrincipal actor,
        String requestId
    ) {
        if (delta == 0 || reason == null || reason.isBlank()) {
            throw new BusinessException(
                "VALIDATION_ERROR",
                "库存变动数量不能为零且原因不能为空",
                HttpStatus.BAD_REQUEST
            );
        }
        repository.ensure(productId);
        int before = repository.lockCurrent(productId);
        if (repository.adjust(productId, delta) != 1) {
            throw insufficientStock();
        }
        int after = before + delta;
        repository.ledger(
            productId,
            null,
            delta,
            before,
            after,
            reason.trim(),
            actor.actorType().name(),
            actor.id()
        );
        auditService.record(
            actor,
            "INVENTORY_ADJUST",
            "PRODUCT",
            Long.toString(productId),
            "delta=" + delta + ", reason=" + reason.trim(),
            requestId
        );
    }

    @Transactional(readOnly = true)
    public int current(long productId) {
        return repository.current(productId);
    }

    @Transactional(readOnly = true)
    public InventoryList list() {
        List<InventoryItem> items = repository.list().stream()
            .map(InventoryItem::from)
            .toList();
        return new InventoryList(items, items.size(), 0, items.size());
    }

    @Transactional(readOnly = true)
    public InventoryItem item(long productId) {
        return repository.item(productId)
            .map(InventoryItem::from)
            .orElseThrow(EntityNotFoundException::new);
    }

    @Transactional
    public void reserve(Map<Long, Integer> quantities, String orderNo) {
        Long orderId = repository.orderId(orderNo);
        quantities.entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .forEach(entry -> {
                long productId = entry.getKey();
                int quantity = entry.getValue();
                if (quantity <= 0) {
                    throw new BusinessException(
                        "VALIDATION_ERROR",
                        "商品数量必须大于零",
                        HttpStatus.BAD_REQUEST
                    );
                }
                repository.ensure(productId);
                int before = repository.lockCurrent(productId);
                if (repository.adjust(productId, -quantity) != 1) {
                    throw insufficientStock();
                }
                repository.ledger(
                    productId,
                    orderId,
                    -quantity,
                    before,
                    before - quantity,
                    "ORDER_RESERVATION",
                    "CUSTOMER",
                    null
                );
            });
    }

    @Transactional
    public void release(String orderNo) {
        long orderId = repository.orderId(orderNo);
        if (!repository.markReleased(orderId)) {
            throw new BusinessException("ORDER_STATE_CONFLICT", "库存已返还");
        }
        for (Map<String, Object> row : repository.reservations(orderId)) {
            long productId = ((Number) row.get("product_id")).longValue();
            int quantity = ((Number) row.get("quantity")).intValue();
            int before = repository.lockCurrent(productId);
            repository.adjust(productId, quantity);
            repository.ledger(
                productId,
                orderId,
                quantity,
                before,
                before + quantity,
                "ORDER_RELEASE",
                "SYSTEM",
                null
            );
        }
    }

    private BusinessException insufficientStock() {
        return new BusinessException(
            "INSUFFICIENT_STOCK",
            "库存不足",
            HttpStatus.CONFLICT
        );
    }

    public record InventoryList(
        List<InventoryItem> items,
        long total,
        int page,
        int size
    ) {
    }

    public record InventoryItem(
        long productId,
        String productName,
        int availableQuantity,
        String unit,
        LocalDateTime updatedAt
    ) {
        static InventoryItem from(InventoryRepository.InventoryRow row) {
            return new InventoryItem(
                row.productId(),
                row.productName(),
                row.availableQuantity(),
                row.unit(),
                row.updatedAt()
            );
        }
    }
}
