package com.luneng.smartstore.catalog;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Repository;

@Repository
public class CatalogRepository {
    @PersistenceContext
    private EntityManager entityManager;

    public Category save(Category category) {
        if (category.getId() == null) {
            entityManager.persist(category);
            return category;
        }
        return entityManager.merge(category);
    }

    public Product save(Product product) {
        if (product.getId() == null) {
            entityManager.persist(product);
            return product;
        }
        return entityManager.merge(product);
    }

    public Optional<Category> category(long id) {
        return Optional.ofNullable(entityManager.find(Category.class, id));
    }

    public Optional<Product> product(long id) {
        return Optional.ofNullable(entityManager.find(Product.class, id));
    }

    public Optional<Product> productForUpdate(long id) {
        return Optional.ofNullable(
            entityManager.find(Product.class, id, LockModeType.PESSIMISTIC_WRITE)
        );
    }

    public Optional<ProductDeletionCandidate> productDeletionCandidate(long id) {
        return entityManager.createQuery(
            "select p.coverImageUrl, p.archived from Product p where p.id = :id",
            Object[].class
        )
            .setParameter("id", id)
            .getResultList()
            .stream()
            .findFirst()
            .map(row -> new ProductDeletionCandidate((String) row[0], (Boolean) row[1]));
    }

    public boolean hasOrderHistory(long productId) {
        return entityManager.createQuery(
            "select count(i) from OrderItem i where i.productId = :productId",
            Long.class
        ).setParameter("productId", productId).getSingleResult() > 0;
    }

    public boolean hasOtherProductUsingImageForUpdate(long productId, String coverImageUrl) {
        if (coverImageUrl == null || coverImageUrl.isBlank()) {
            return false;
        }
        return !entityManager.createQuery(
            "select p from Product p where p.id <> :productId "
                + "and p.coverImageUrl = :coverImageUrl",
            Product.class
        )
            .setParameter("productId", productId)
            .setParameter("coverImageUrl", coverImageUrl)
            .setLockMode(LockModeType.PESSIMISTIC_WRITE)
            .setMaxResults(1)
            .getResultList().isEmpty();
    }

    public boolean lockImageForReference(String coverImageUrl) {
        if (!isLocalImage(coverImageUrl)) {
            return true;
        }
        ensureImageGuard(coverImageUrl);
        Object value = entityManager.createNativeQuery(
            "select deleting from product_image_guard where image_url = :imageUrl for update"
        ).setParameter("imageUrl", coverImageUrl).getSingleResult();
        return !asBoolean(value);
    }

    public boolean lockImageForDeletion(String coverImageUrl) {
        if (!isLocalImage(coverImageUrl)) {
            return false;
        }
        ensureImageGuard(coverImageUrl);
        entityManager.createNativeQuery(
            "select deleting from product_image_guard where image_url = :imageUrl for update"
        ).setParameter("imageUrl", coverImageUrl).getSingleResult();
        return true;
    }

    public void markImageForDeletion(String coverImageUrl) {
        entityManager.createNativeQuery(
            "update product_image_guard set deleting = true where image_url = :imageUrl"
        ).setParameter("imageUrl", coverImageUrl).executeUpdate();
    }

    private void ensureImageGuard(String coverImageUrl) {
        entityManager.createNativeQuery(
            "insert ignore into product_image_guard(image_url, deleting) values (:imageUrl, false)"
        ).setParameter("imageUrl", coverImageUrl).executeUpdate();
    }

    private boolean isLocalImage(String coverImageUrl) {
        return coverImageUrl != null && coverImageUrl.startsWith("/files/");
    }

    private boolean asBoolean(Object value) {
        if (value instanceof Boolean booleanValue) {
            return booleanValue;
        }
        return ((Number) value).intValue() != 0;
    }

    public void delete(Product product) {
        entityManager.remove(product);
    }

    public List<Category> categories(boolean publicOnly) {
        String jpql = publicOnly
            ? "select c from Category c where c.enabled = true order by c.sortOrder, c.id"
            : "select c from Category c order by c.sortOrder, c.id";
        return entityManager.createQuery(jpql, Category.class).getResultList();
    }

    public ProductPage products(
        Long categoryId,
        String keyword,
        int page,
        int size,
        boolean publicOnly,
        ProductArchiveStatus archiveStatus
    ) {
        String filters = """
             where (:categoryId is null or p.category.id = :categoryId)
               and (:keyword = '' or lower(p.name) like lower(concat('%', :keyword, '%')))
            """
            + archiveFilter(publicOnly, archiveStatus);
        String inventoryJoin = publicOnly
            ? " left join OnlineInventory i on i.productId = p.id"
            : "";
        String ordering = publicOnly
            ? " order by case when coalesce(i.availableQuantity, 0) > 0 then 0 else 1 end, p.id desc"
            : " order by p.id desc";
        var query = entityManager.createQuery(
            "select p from Product p join fetch p.category" + inventoryJoin + filters + ordering,
            Product.class
        );
        query.setParameter("categoryId", categoryId);
        query.setParameter("keyword", keyword == null ? "" : keyword.trim());
        query.setFirstResult(page * size);
        query.setMaxResults(size);

        var count = entityManager.createQuery(
            "select count(p) from Product p" + filters,
            Long.class
        );
        count.setParameter("categoryId", categoryId);
        count.setParameter("keyword", keyword == null ? "" : keyword.trim());
        return new ProductPage(query.getResultList(), count.getSingleResult());
    }

    private String archiveFilter(boolean publicOnly, ProductArchiveStatus archiveStatus) {
        if (publicOnly) {
            return " and p.archived = false and p.onShelf = true and p.category.enabled = true";
        }
        return switch (archiveStatus) {
            case ACTIVE -> " and p.archived = false";
            case ARCHIVED -> " and p.archived = true";
            case ALL -> "";
        };
    }

    public record ProductPage(List<Product> items, long total) {
    }

    public record ProductDeletionCandidate(String coverImageUrl, boolean archived) {
    }
}
