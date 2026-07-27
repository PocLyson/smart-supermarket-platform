package com.luneng.smartstore.order;

import com.luneng.smartstore.audit.AuditService;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.inventory.InventoryService;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminOrderService {
    private final OrderRepository repository;
    private final InventoryService inventoryService;
    private final AuditService auditService;

    public AdminOrderService(
        OrderRepository repository,
        InventoryService inventoryService,
        AuditService auditService
    ) {
        this.repository = repository;
        this.inventoryService = inventoryService;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public Page<OrderView> list(
        OrderStatus status,
        PaymentStatus paymentStatus,
        String keyword,
        int page,
        int size
    ) {
        return repository.searchAdmin(
            status,
            paymentStatus,
            keyword == null ? "" : keyword.trim(),
            PageRequest.of(
                Math.max(page, 0),
                Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Direction.DESC, "createdAt")
            )
        ).map(OrderView::from);
    }

    @Transactional(readOnly = true)
    public OrderView detail(String orderNo) {
        return OrderView.from(repository.findDetailedByOrderNo(orderNo)
            .orElseThrow(EntityNotFoundException::new));
    }

    @Transactional
    public OrderView accept(String orderNo, CurrentPrincipal actor, String requestId) {
        CustomerOrder order = locked(orderNo);
        order.accept(actor.id());
        audit(actor, "ORDER_ACCEPT", order, "PREPARING", requestId);
        return OrderView.from(order);
    }

    @Transactional
    public OrderView markReady(String orderNo, CurrentPrincipal actor, String requestId) {
        CustomerOrder order = locked(orderNo);
        order.markReady(actor.id());
        audit(actor, "ORDER_READY", order, "READY_FOR_PICKUP", requestId);
        return OrderView.from(order);
    }

    @Transactional
    public OrderView markPaid(
        String orderNo,
        PaymentMethod method,
        CurrentPrincipal actor,
        String requestId
    ) {
        CustomerOrder order = locked(orderNo);
        order.markPaid(method);
        audit(actor, "ORDER_PAY", order, method.name(), requestId);
        return OrderView.from(order);
    }

    @Transactional
    public OrderView complete(String orderNo, CurrentPrincipal actor, String requestId) {
        CustomerOrder order = locked(orderNo);
        order.complete(actor.id());
        audit(actor, "ORDER_COMPLETE", order, "COMPLETED", requestId);
        return OrderView.from(order);
    }

    @Transactional
    public OrderView reject(
        String orderNo,
        String reason,
        CurrentPrincipal actor,
        String requestId
    ) {
        CustomerOrder order = locked(orderNo);
        if (order.getStatus() != OrderStatus.PENDING_CONFIRMATION) {
            throw new com.luneng.smartstore.common.api.BusinessException(
                "ORDER_STATE_CONFLICT",
                "仅待确认订单可以拒单"
            );
        }
        return cancelLocked(order, reason, actor, requestId, "ORDER_REJECT");
    }

    @Transactional
    public OrderView cancel(
        String orderNo,
        String reason,
        CurrentPrincipal actor,
        String requestId
    ) {
        return cancelLocked(locked(orderNo), reason, actor, requestId, "ORDER_CANCEL");
    }

    private OrderView cancelLocked(
        CustomerOrder order,
        String reason,
        CurrentPrincipal actor,
        String requestId,
        String action
    ) {
        order.cancelByStaff(actor.id(), reason);
        inventoryService.release(order.getOrderNo());
        order.markInventoryReleased();
        audit(actor, action, order, reason.trim(), requestId);
        return OrderView.from(order);
    }

    private CustomerOrder locked(String orderNo) {
        return repository.findLockedByOrderNo(orderNo)
            .orElseThrow(EntityNotFoundException::new);
    }

    private void audit(
        CurrentPrincipal actor,
        String action,
        CustomerOrder order,
        String summary,
        String requestId
    ) {
        auditService.record(actor, action, "ORDER", order.getOrderNo(), summary, requestId);
    }
}
