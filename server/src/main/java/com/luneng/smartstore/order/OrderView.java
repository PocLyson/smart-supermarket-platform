package com.luneng.smartstore.order;

import java.time.Instant;
import java.util.List;

public record OrderView(
    String orderNo,
    long totalCent,
    OrderStatus status,
    PaymentStatus paymentStatus,
    PaymentMethod paymentMethod,
    String pickupName,
    String phone,
    String cancelledBy,
    String cancelReason,
    Instant createdAt,
    List<ItemView> items,
    List<HistoryView> history
) {
    static OrderView from(CustomerOrder order) {
        return new OrderView(
            order.getOrderNo(),
            order.getTotalCent(),
            order.getStatus(),
            order.getPaymentStatus(),
            order.getPaymentMethod(),
            order.getPickupName(),
            order.getPhone(),
            order.getCancelledBy(),
            order.getCancelReason(),
            order.getCreatedAt(),
            order.getItems().stream().map(ItemView::from).toList(),
            order.getHistories().stream().map(HistoryView::from).toList()
        );
    }

    public record ItemView(
        long productId,
        String productName,
        String unit,
        long unitPriceCent,
        int quantity,
        long subtotalCent
    ) {
        static ItemView from(OrderItem item) {
            return new ItemView(
                item.getProductId(),
                item.getProductName(),
                item.getUnit(),
                item.getUnitPriceCent(),
                item.getQuantity(),
                item.getSubtotalCent()
            );
        }
    }

    public record HistoryView(
        OrderStatus fromStatus,
        OrderStatus toStatus,
        String actorType,
        long actorId,
        String remark,
        Instant createdAt
    ) {
        static HistoryView from(OrderStatusHistory history) {
            return new HistoryView(
                history.getFromStatus(),
                history.getToStatus(),
                history.getActorType(),
                history.getActorId(),
                history.getRemark(),
                history.getCreatedAt()
            );
        }
    }
}
