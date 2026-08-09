package com.luneng.smartstore.merchant;

import com.luneng.smartstore.audit.AuditService;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.common.api.BusinessException;
import com.luneng.smartstore.order.AdminOrderService;
import com.luneng.smartstore.order.AdminOrderView;
import com.luneng.smartstore.order.CustomerOrder;
import com.luneng.smartstore.order.OrderRepository;
import com.luneng.smartstore.order.OrderStatus;
import com.luneng.smartstore.order.PaymentMethod;
import com.luneng.smartstore.order.PaymentStatus;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MerchantOrderService {
    private final AdminOrderService adminOrders;
    private final OrderRepository repository;
    private final AuditService auditService;

    public MerchantOrderService(
        AdminOrderService adminOrders,
        OrderRepository repository,
        AuditService auditService
    ) {
        this.adminOrders = adminOrders;
        this.repository = repository;
        this.auditService = auditService;
    }

    public Page<AdminOrderView> list(
        OrderStatus status,
        PaymentStatus paymentStatus,
        String keyword,
        boolean archived,
        int page,
        int size
    ) {
        return adminOrders.list(status, paymentStatus, keyword, archived, page, size);
    }

    public AdminOrderView detail(String orderNo) {
        return adminOrders.detail(orderNo);
    }

    public AdminOrderView accept(String orderNo, CurrentPrincipal actor, String requestId) {
        return adminOrders.accept(orderNo, actor, requestId);
    }

    public AdminOrderView markReady(String orderNo, CurrentPrincipal actor, String requestId) {
        return adminOrders.markReady(orderNo, actor, requestId);
    }

    public AdminOrderView markPaid(
        String orderNo,
        PaymentMethod method,
        CurrentPrincipal actor,
        String requestId
    ) {
        return adminOrders.markPaid(orderNo, method, actor, requestId);
    }

    public AdminOrderView cancel(
        String orderNo,
        String reason,
        CurrentPrincipal actor,
        String requestId
    ) {
        return adminOrders.cancel(orderNo, reason, actor, requestId);
    }

    @Transactional
    public AdminOrderView verifyPickup(
        String orderNo,
        String pickupCode,
        PaymentMethod payAtStoreMethod,
        CurrentPrincipal actor,
        String requestId
    ) {
        CustomerOrder order = repository.findLockedByOrderNo(orderNo)
            .orElseThrow(EntityNotFoundException::new);
        if (auditService.wasRecorded(
            actor, "ORDER_COMPLETE", "ORDER", orderNo, requestId
        )) {
            return AdminOrderView.from(order);
        }
        order.verifyPickupCode(pickupCode);
        if (order.getPaymentStatus() == PaymentStatus.UNPAID) {
            order.markPaid(requirePayAtStoreMethod(payAtStoreMethod));
        }
        order.completeAfterVerified(actor.id());
        auditService.record(
            actor,
            "ORDER_COMPLETE",
            "ORDER",
            order.getOrderNo(),
            "COMPLETED",
            requestId
        );
        return AdminOrderView.from(order);
    }

    private PaymentMethod requirePayAtStoreMethod(PaymentMethod method) {
        if (method != PaymentMethod.CASH && method != PaymentMethod.WECHAT_QR) {
            throw new BusinessException(
                "VALIDATION_ERROR",
                "到店付款方式必须为 CASH 或 WECHAT_QR",
                HttpStatus.BAD_REQUEST
            );
        }
        return method;
    }
}
