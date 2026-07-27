package com.luneng.smartstore.catalog;

import com.luneng.smartstore.common.api.ApiResponse;
import com.luneng.smartstore.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminCatalogController {
    private final CatalogService service;

    public AdminCatalogController(CatalogService service) {
        this.service = service;
    }

    @GetMapping("/categories")
    ApiResponse<List<CatalogService.CategoryView>> categories(HttpServletRequest request) {
        return ApiResponse.success(RequestIdFilter.requestId(request), service.categories(false));
    }

    @PostMapping("/categories")
    ApiResponse<CatalogService.CategoryView> createCategory(
        @Valid @RequestBody CategoryRequest body,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            service.createCategory(body.toCommand())
        );
    }

    @PutMapping("/categories/{id}")
    ApiResponse<CatalogService.CategoryView> updateCategory(
        @PathVariable long id,
        @Valid @RequestBody CategoryRequest body,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            service.updateCategory(id, body.toCommand())
        );
    }

    @GetMapping("/products")
    ApiResponse<CatalogService.ProductList> products(
        @RequestParam(required = false) Long categoryId,
        @RequestParam(defaultValue = "") String keyword,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            service.products(categoryId, keyword, page, size, false)
        );
    }

    @PostMapping("/products")
    ApiResponse<CatalogService.ProductView> createProduct(
        @Valid @RequestBody ProductWriteRequest body,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            service.createProduct(body)
        );
    }

    @PutMapping("/products/{id}")
    ApiResponse<CatalogService.ProductView> updateProduct(
        @PathVariable long id,
        @Valid @RequestBody ProductWriteRequest body,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            service.updateProduct(id, body)
        );
    }

    @PatchMapping("/products/{id}/shelf")
    ApiResponse<CatalogService.ProductView> shelf(
        @PathVariable long id,
        @RequestBody ShelfRequest body,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            service.shelf(id, body.onShelf())
        );
    }

    record CategoryRequest(@NotBlank String name, int sortOrder, boolean enabled) {
        CatalogService.CategoryWriteRequest toCommand() {
            return new CatalogService.CategoryWriteRequest(name, sortOrder, enabled);
        }
    }

    record ShelfRequest(boolean onShelf) {
    }
}
