package com.luneng.smartstore.catalog;

import com.luneng.smartstore.common.api.BusinessException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

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

    @Column(nullable = false)
    private boolean archived;

    @Column(name = "archived_at")
    private Instant archivedAt;

    @Column(name = "archived_by")
    private Long archivedBy;

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
        rejectArchivedChange();
        this.category = category;
        this.name = name;
        this.priceCent = priceCent;
        this.unit = unit;
        this.coverImageUrl = coverImageUrl;
        this.description = description;
        this.onShelf = onShelf;
    }

    public void setOnShelf(boolean onShelf) {
        if (archived && onShelf) {
            throw archived();
        }
        this.onShelf = onShelf;
    }

    public boolean archive(long actorId) {
        if (archived) {
            return false;
        }
        archived = true;
        archivedAt = Instant.now();
        archivedBy = actorId;
        onShelf = false;
        return true;
    }

    public boolean restore(long actorId) {
        if (!archived) {
            return false;
        }
        archived = false;
        archivedAt = null;
        archivedBy = null;
        onShelf = false;
        return true;
    }

    private void rejectArchivedChange() {
        if (archived) {
            throw archived();
        }
    }

    private BusinessException archived() {
        return new BusinessException("PRODUCT_ARCHIVED", "归档商品不可编辑或上架");
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

    public boolean isArchived() {
        return archived;
    }

    public Instant getArchivedAt() {
        return archivedAt;
    }

    public Long getArchivedBy() {
        return archivedBy;
    }
}
