package com.luneng.smartstore.catalog;

import com.luneng.smartstore.audit.AuditService;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.inventory.InventoryRepository;
import com.luneng.smartstore.inventory.InventoryService;
import jakarta.persistence.EntityNotFoundException;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CatalogService {
    private final CatalogRepository repository;
    private final AuditService auditService;
    private final InventoryRepository inventoryRepository;
    private final InventoryService inventoryService;

    public CatalogService(
        CatalogRepository repository,
        AuditService auditService,
        InventoryRepository inventoryRepository,
        InventoryService inventoryService
    ) {
        this.repository = repository;
        this.auditService = auditService;
        this.inventoryRepository = inventoryRepository;
        this.inventoryService = inventoryService;
    }

    @Transactional(readOnly = true)
    public List<CategoryView> categories(boolean publicOnly) {
        return repository.categories(publicOnly).stream().map(CategoryView::from).toList();
    }

    @Transactional
    public CategoryView createCategory(
        CategoryWriteRequest request,
        CurrentPrincipal actor,
        String requestId
    ) {
        Category category = repository.save(
            new Category(request.name(), request.sortOrder(), request.enabled())
        );
        auditService.record(
            actor, "CATEGORY_CREATE", "CATEGORY", category.getId().toString(),
            category.getName(), requestId
        );
        return CategoryView.from(category);
    }

    @Transactional
    public CategoryView updateCategory(
        long id,
        CategoryWriteRequest request,
        CurrentPrincipal actor,
        String requestId
    ) {
        Category category = repository.category(id).orElseThrow(EntityNotFoundException::new);
        category.update(request.name(), request.sortOrder(), request.enabled());
        auditService.record(
            actor, "CATEGORY_UPDATE", "CATEGORY", Long.toString(id),
            category.getName(), requestId
        );
        return CategoryView.from(category);
    }

    @Transactional(readOnly = true)
    public ProductList products(
        Long categoryId,
        String keyword,
        int page,
        int size,
        boolean publicOnly
    ) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        CatalogRepository.ProductPage result =
            repository.products(categoryId, keyword, safePage, safeSize, publicOnly);
        return new ProductList(
            result.items().stream()
                .map(product -> ProductView.from(
                    product,
                    inventoryRepository.current(product.getId())
                ))
                .toList(),
            result.total(),
            safePage,
            safeSize
        );
    }

    @Transactional(readOnly = true)
    public ProductView product(long id, boolean publicOnly) {
        Product product = repository.product(id).orElseThrow(EntityNotFoundException::new);
        if (publicOnly && (!product.isOnShelf() || !product.getCategory().isEnabled())) {
            throw new EntityNotFoundException();
        }
        return ProductView.from(product, inventoryRepository.current(product.getId()));
    }

    @Transactional
    public ProductView createProduct(
        ProductWriteRequest request,
        CurrentPrincipal actor,
        String requestId
    ) {
        Category category = repository.category(request.categoryId())
            .orElseThrow(EntityNotFoundException::new);
        Product product = repository.save(new Product(
            category,
            request.name(),
            request.priceCent(),
            request.unit(),
            request.coverImageUrl(),
            request.description(),
            request.onShelf()
        ));
        inventoryRepository.ensure(product.getId());
        int initialStock = request.initialStock() == null ? 0 : request.initialStock();
        if (initialStock > 0) {
            inventoryService.adjust(
                product.getId(),
                initialStock,
                "新品录入初始库存",
                actor,
                requestId
            );
        }
        auditService.record(
            actor, "PRODUCT_CREATE", "PRODUCT", product.getId().toString(),
            product.getName(), requestId
        );
        return ProductView.from(product, initialStock);
    }

    @Transactional
    public ProductView updateProduct(
        long id,
        ProductWriteRequest request,
        CurrentPrincipal actor,
        String requestId
    ) {
        Product product = repository.product(id).orElseThrow(EntityNotFoundException::new);
        Category category = repository.category(request.categoryId())
            .orElseThrow(EntityNotFoundException::new);
        product.update(
            category,
            request.name(),
            request.priceCent(),
            request.unit(),
            request.coverImageUrl(),
            request.description(),
            request.onShelf()
        );
        auditService.record(
            actor, "PRODUCT_UPDATE", "PRODUCT", Long.toString(id),
            product.getName(), requestId
        );
        return ProductView.from(product, inventoryRepository.current(product.getId()));
    }

    @Transactional
    public ProductView shelf(
        long id,
        boolean onShelf,
        CurrentPrincipal actor,
        String requestId
    ) {
        Product product = repository.product(id).orElseThrow(EntityNotFoundException::new);
        product.setOnShelf(onShelf);
        auditService.record(
            actor, "PRODUCT_SHELF", "PRODUCT", Long.toString(id),
            onShelf ? "上架" : "下架", requestId
        );
        return ProductView.from(product, inventoryRepository.current(product.getId()));
    }

    public record CategoryWriteRequest(String name, int sortOrder, boolean enabled) {
    }

    public record CategoryView(long id, String name, int sortOrder, boolean enabled) {
        static CategoryView from(Category category) {
            return new CategoryView(
                category.getId(),
                category.getName(),
                category.getSortOrder(),
                category.isEnabled()
            );
        }
    }

    public record ProductView(
        long id,
        long categoryId,
        String categoryName,
        String name,
        long priceCent,
        String unit,
        String coverImageUrl,
        String description,
        boolean onShelf,
        int availableStock
    ) {
        static ProductView from(Product product, int availableStock) {
            return new ProductView(
                product.getId(),
                product.getCategory().getId(),
                product.getCategory().getName(),
                product.getName(),
                product.getPriceCent(),
                product.getUnit(),
                product.getCoverImageUrl(),
                product.getDescription(),
                product.isOnShelf(),
                availableStock
            );
        }
    }

    public record ProductList(List<ProductView> items, long total, int page, int size) {
    }
}
