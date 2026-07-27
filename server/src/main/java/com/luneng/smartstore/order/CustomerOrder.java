package com.luneng.smartstore.order;

import com.luneng.smartstore.common.api.BusinessException;
import com.luneng.smartstore.customer.CustomerUser;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "customer_order")
public class CustomerOrder {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_no", nullable = false, unique = true, length = 32)
    private String orderNo;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id")
    private CustomerUser customer;

    @Column(name = "idempotency_key", nullable = false, length = 128)
    private String idempotencyKey;

    @Column(name = "pickup_name", nullable = false, length = 40)
    private String pickupName;

    @Column(nullable = false, length = 20)
    private String phone;

    @Column(name = "total_cent", nullable = false)
    private long totalCent;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private OrderStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false, length = 32)
    private PaymentStatus paymentStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", length = 32)
    private PaymentMethod paymentMethod;

    @Column(name = "cancelled_by", length = 32)
    private String cancelledBy;

    @Column(name = "cancel_reason", length = 500)
    private String cancelReason;

    @Column(name = "inventory_released", nullable = false)
    private boolean inventoryReleased;

    @Column(name = "accepted_at")
    private Instant acceptedAt;

    @Column(name = "ready_at")
    private Instant readyAt;

    @Column(name = "paid_at")
    private Instant paidAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id")
    private List<OrderItem> items = new ArrayList<>();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id")
    private List<OrderStatusHistory> histories = new ArrayList<>();

    protected CustomerOrder() {
    }

    public CustomerOrder(
        String orderNo,
        CustomerUser customer,
        String idempotencyKey,
        String pickupName,
        String phone,
        long totalCent
    ) {
        this.orderNo = orderNo;
        this.customer = customer;
        this.idempotencyKey = idempotencyKey;
        this.pickupName = pickupName;
        this.phone = phone;
        this.totalCent = totalCent;
        this.status = OrderStatus.PENDING_CONFIRMATION;
        this.paymentStatus = PaymentStatus.UNPAID;
    }

    public void addItem(OrderItem item) {
        item.attach(this);
        items.add(item);
    }

    public void addHistory(OrderStatusHistory history) {
        history.attach(this);
        histories.add(history);
    }

    public void cancelByCustomer(long customerId) {
        if (status != OrderStatus.PENDING_CONFIRMATION) {
            throw new BusinessException("ORDER_STATE_CONFLICT", "当前状态不允许顾客取消");
        }
        OrderStatus previous = status;
        status = OrderStatus.CANCELLED;
        cancelledBy = "CUSTOMER";
        cancelReason = "顾客取消";
        cancelledAt = Instant.now();
        addHistory(new OrderStatusHistory(
            previous,
            status,
            "CUSTOMER",
            customerId,
            cancelReason
        ));
    }

    public void markInventoryReleased() {
        this.inventoryReleased = true;
    }

    public Long getId() {
        return id;
    }

    public String getOrderNo() {
        return orderNo;
    }

    public CustomerUser getCustomer() {
        return customer;
    }

    public String getPickupName() {
        return pickupName;
    }

    public String getPhone() {
        return phone;
    }

    public long getTotalCent() {
        return totalCent;
    }

    public OrderStatus getStatus() {
        return status;
    }

    public PaymentStatus getPaymentStatus() {
        return paymentStatus;
    }

    public PaymentMethod getPaymentMethod() {
        return paymentMethod;
    }

    public String getCancelledBy() {
        return cancelledBy;
    }

    public String getCancelReason() {
        return cancelReason;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public List<OrderItem> getItems() {
        return items;
    }

    public List<OrderStatusHistory> getHistories() {
        return histories;
    }
}
