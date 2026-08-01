package com.luneng.smartstore.catalog;

import com.luneng.smartstore.common.api.ApiResponse;
import com.luneng.smartstore.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mini")
public class MiniCatalogController {
    private final CatalogService service;

    public MiniCatalogController(CatalogService service) {
        this.service = service;
    }

    @GetMapping("/categories")
    ApiResponse<List<CatalogService.CategoryView>> categories(HttpServletRequest request) {
        return ApiResponse.success(RequestIdFilter.requestId(request), service.categories(true));
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
            service.products(
                categoryId,
                keyword,
                page,
                size,
                true,
                ProductArchiveStatus.ACTIVE
            )
        );
    }

    @GetMapping("/products/{id}")
    ApiResponse<CatalogService.ProductView> product(
        @PathVariable long id,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            service.product(id, true)
        );
    }
}
