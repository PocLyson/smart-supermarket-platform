package com.luneng.smartstore.inventory;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "online_inventory")
public class OnlineInventory {
    @Id
    @Column(name = "product_id")
    private Long productId;

    @Column(name = "available_quantity", nullable = false)
    private int availableQuantity;

    @Version
    @Column(nullable = false)
    private long version;

    protected OnlineInventory() {
    }
}
