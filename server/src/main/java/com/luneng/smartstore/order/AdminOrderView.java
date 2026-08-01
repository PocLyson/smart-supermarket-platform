package com.luneng.smartstore.order;

import java.time.Instant;
import java.util.List;

public record AdminOrderView(
    String orderNo,
    long totalCent,
    OrderStatus status,
    PaymentStatus paymentStatus,
    PaymentMethod paymentMethod,
    String pickupName,
    String phone,
    String customerNote,
    String cancelledBy,
    String cancelReason,
    Instant createdAt,
    List<OrderView.ItemView> items,
    List<OrderView.HistoryView> history
) {
    static AdminOrderView from(CustomerOrder order) {
        OrderView view = OrderView.from(order);
        return new AdminOrderView(
            view.orderNo(),
            view.totalCent(),
            view.status(),
            view.paymentStatus(),
            view.paymentMethod(),
            view.pickupName(),
            view.phone(),
            view.customerNote(),
            view.cancelledBy(),
            view.cancelReason(),
            view.createdAt(),
            view.items(),
            view.history()
        );
    }
}
