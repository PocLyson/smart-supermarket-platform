package com.luneng.smartstore.merchant;

import com.luneng.smartstore.inventory.InventoryService;
import com.luneng.smartstore.order.AdminOrderService;
import com.luneng.smartstore.order.AdminOrderView;
import com.luneng.smartstore.order.OrderRepository;
import com.luneng.smartstore.order.OrderStatus;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MerchantDashboardService {
    private static final int LATEST_ORDER_LIMIT = 5;

    private final OrderRepository orderRepository;
    private final AdminOrderService adminOrders;
    private final InventoryService inventoryService;

    public MerchantDashboardService(
        OrderRepository orderRepository,
        AdminOrderService adminOrders,
        InventoryService inventoryService
    ) {
        this.orderRepository = orderRepository;
        this.adminOrders = adminOrders;
        this.inventoryService = inventoryService;
    }

    @Transactional(readOnly = true)
    public DashboardView dashboard() {
        Map<OrderStatus, Long> orderCounts = new EnumMap<>(OrderStatus.class);
        for (OrderStatus status : OrderStatus.values()) {
            orderCounts.put(
                status,
                orderRepository.countByStatusAndAdminHiddenFalse(status)
            );
        }
        long lowStockCount = inventoryService.list(
            null,
            InventoryService.StockStatus.LOW_STOCK
        ).total();
        List<AdminOrderView> latestOrders = adminOrders.list(
            null, null, "", false, 0, LATEST_ORDER_LIMIT
        ).getContent();
        return new DashboardView(orderCounts, lowStockCount, 0, latestOrders);
    }

    public record DashboardView(
        Map<OrderStatus, Long> orderCounts,
        long lowStockCount,
        long waitingConversationCount,
        List<AdminOrderView> latestOrders
    ) {
    }
}
