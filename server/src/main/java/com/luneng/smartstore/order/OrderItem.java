package com.luneng.smartstore.order;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "order_item")
public class OrderItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id")
    private CustomerOrder order;

    @Column(name = "product_id", nullable = false)
    private long productId;

    @Column(name = "product_name", nullable = false, length = 160)
    private String productName;

    @Column(nullable = false, length = 40)
    private String unit;

    @Column(name = "unit_price_cent", nullable = false)
    private long unitPriceCent;

    @Column(nullable = false)
    private int quantity;

    @Column(name = "subtotal_cent", nullable = false)
    private long subtotalCent;

    protected OrderItem() {
    }

    public OrderItem(
        long productId,
        String productName,
        String unit,
        long unitPriceCent,
        int quantity,
        long subtotalCent
    ) {
        this.productId = productId;
        this.productName = productName;
        this.unit = unit;
        this.unitPriceCent = unitPriceCent;
        this.quantity = quantity;
        this.subtotalCent = subtotalCent;
    }

    void attach(CustomerOrder order) {
        this.order = order;
    }

    public long getProductId() {
        return productId;
    }

    public String getProductName() {
        return productName;
    }

    public String getUnit() {
        return unit;
    }

    public long getUnitPriceCent() {
        return unitPriceCent;
    }

    public int getQuantity() {
        return quantity;
    }

    public long getSubtotalCent() {
        return subtotalCent;
    }
}
