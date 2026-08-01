package com.luneng.smartstore.catalog;

import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.common.api.ApiResponse;
import com.luneng.smartstore.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

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
        @AuthenticationPrincipal CurrentPrincipal principal,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(
            requestId,
            service.createCategory(body.toCommand(), principal, requestId)
        );
    }

    @PutMapping("/categories/{id}")
    ApiResponse<CatalogService.CategoryView> updateCategory(
        @PathVariable long id,
        @Valid @RequestBody CategoryRequest body,
        @AuthenticationPrincipal CurrentPrincipal principal,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(
            requestId,
            service.updateCategory(id, body.toCommand(), principal, requestId)
        );
    }

    @GetMapping("/products")
    ApiResponse<CatalogService.ProductList> products(
        @RequestParam(required = false) Long categoryId,
        @RequestParam(defaultValue = "") String keyword,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(defaultValue = "ACTIVE") ProductArchiveStatus archiveStatus,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            service.products(categoryId, keyword, page, size, false, archiveStatus)
        );
    }

    @DeleteMapping("/products/{id}")
    ApiResponse<CatalogService.ProductView> archive(
        @PathVariable long id,
        @AuthenticationPrincipal CurrentPrincipal principal,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(
            requestId,
            service.archive(id, principal, requestId)
        );
    }

    @PostMapping("/products/{id}/restore")
    ApiResponse<CatalogService.ProductView> restore(
        @PathVariable long id,
        @AuthenticationPrincipal CurrentPrincipal principal,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(
            requestId,
            service.restore(id, principal, requestId)
        );
    }

    @DeleteMapping("/products/{id}/permanent")
    ApiResponse<CatalogService.ProductDeletion> permanentDelete(
        @PathVariable long id,
        @AuthenticationPrincipal CurrentPrincipal principal,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(
            requestId,
            service.permanentDelete(id, principal, requestId)
        );
    }

    @PostMapping("/products")
    ApiResponse<CatalogService.ProductView> createProduct(
        @Valid @RequestBody ProductWriteRequest body,
        @AuthenticationPrincipal CurrentPrincipal principal,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(
            requestId,
            service.createProduct(body, principal, requestId)
        );
    }

    @PutMapping("/products/{id}")
    ApiResponse<CatalogService.ProductView> updateProduct(
        @PathVariable long id,
        @Valid @RequestBody ProductWriteRequest body,
        @AuthenticationPrincipal CurrentPrincipal principal,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(
            requestId,
            service.updateProduct(id, body, principal, requestId)
        );
    }

    @PatchMapping("/products/{id}/shelf")
    ApiResponse<CatalogService.ProductView> shelf(
        @PathVariable long id,
        @RequestBody ShelfRequest body,
        @AuthenticationPrincipal CurrentPrincipal principal,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(
            requestId,
            service.shelf(id, body.onShelf(), principal, requestId)
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
