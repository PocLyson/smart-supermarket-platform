package com.luneng.smartstore.order;

import java.util.List;

public record CreateOrderCommand(
    long customerId,
    String idempotencyKey,
    String pickupName,
    String phone,
    String customerNote,
    List<CreateOrderItem> items
) {
}
