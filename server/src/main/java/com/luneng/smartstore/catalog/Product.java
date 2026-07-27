package com.luneng.smartstore.catalog;

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
@Table(name = "product")
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id")
    private Category category;

    @Column(nullable = false, length = 160)
    private String name;

    @Column(name = "price_cent", nullable = false)
    private long priceCent;

    @Column(nullable = false, length = 40)
    private String unit;

    @Column(name = "cover_image_url", length = 500)
    private String coverImageUrl;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "on_shelf", nullable = false)
    private boolean onShelf;

    protected Product() {
    }

    public Product(
        Category category,
        String name,
        long priceCent,
        String unit,
        String coverImageUrl,
        String description,
        boolean onShelf
    ) {
        update(category, name, priceCent, unit, coverImageUrl, description, onShelf);
    }

    public void update(
        Category category,
        String name,
        long priceCent,
        String unit,
        String coverImageUrl,
        String description,
        boolean onShelf
    ) {
        this.category = category;
        this.name = name;
        this.priceCent = priceCent;
        this.unit = unit;
        this.coverImageUrl = coverImageUrl;
        this.description = description;
        this.onShelf = onShelf;
    }

    public void setOnShelf(boolean onShelf) {
        this.onShelf = onShelf;
    }

    public Long getId() {
        return id;
    }

    public Category getCategory() {
        return category;
    }

    public String getName() {
        return name;
    }

    public long getPriceCent() {
        return priceCent;
    }

    public String getUnit() {
        return unit;
    }

    public String getCoverImageUrl() {
        return coverImageUrl;
    }

    public String getDescription() {
        return description;
    }

    public boolean isOnShelf() {
        return onShelf;
    }
}
