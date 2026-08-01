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
}
