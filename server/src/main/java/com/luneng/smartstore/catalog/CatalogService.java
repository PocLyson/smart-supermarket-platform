package com.luneng.smartstore.catalog;

import jakarta.persistence.EntityNotFoundException;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CatalogService {
    private final CatalogRepository repository;

    public CatalogService(CatalogRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<CategoryView> categories(boolean publicOnly) {
        return repository.categories(publicOnly).stream().map(CategoryView::from).toList();
    }

    @Transactional
    public CategoryView createCategory(CategoryWriteRequest request) {
        return CategoryView.from(repository.save(
            new Category(request.name(), request.sortOrder(), request.enabled())
        ));
    }

    @Transactional
    public CategoryView updateCategory(long id, CategoryWriteRequest request) {
        Category category = repository.category(id).orElseThrow(EntityNotFoundException::new);
        category.update(request.name(), request.sortOrder(), request.enabled());
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
            result.items().stream().map(ProductView::from).toList(),
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
        return ProductView.from(product);
    }

    @Transactional
    public ProductView createProduct(ProductWriteRequest request) {
        Category category = repository.category(request.categoryId())
            .orElseThrow(EntityNotFoundException::new);
        return ProductView.from(repository.save(new Product(
            category,
            request.name(),
            request.priceCent(),
            request.unit(),
            request.coverImageUrl(),
            request.description(),
            request.onShelf()
        )));
    }

    @Transactional
    public ProductView updateProduct(long id, ProductWriteRequest request) {
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
        return ProductView.from(product);
    }

    @Transactional
    public ProductView shelf(long id, boolean onShelf) {
        Product product = repository.product(id).orElseThrow(EntityNotFoundException::new);
        product.setOnShelf(onShelf);
        return ProductView.from(product);
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
        boolean onShelf
    ) {
        static ProductView from(Product product) {
            return new ProductView(
                product.getId(),
                product.getCategory().getId(),
                product.getCategory().getName(),
                product.getName(),
                product.getPriceCent(),
                product.getUnit(),
                product.getCoverImageUrl(),
                product.getDescription(),
                product.isOnShelf()
            );
        }
    }

    public record ProductList(List<ProductView> items, long total, int page, int size) {
    }
}
