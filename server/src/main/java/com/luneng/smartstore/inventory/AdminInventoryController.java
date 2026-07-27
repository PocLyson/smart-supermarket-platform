package com.luneng.smartstore.inventory;

import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.common.api.ApiResponse;
import com.luneng.smartstore.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/inventory")
public class AdminInventoryController {
    private final InventoryService service;

    public AdminInventoryController(InventoryService service) {
        this.service = service;
    }

    @GetMapping
    ApiResponse<Map<String, String>> list(HttpServletRequest request) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            Map.of("message", "使用商品 ID 查询或调整库存")
        );
    }

    @PostMapping("/{productId}/adjustments")
    ApiResponse<Map<String, Integer>> adjust(
        @PathVariable long productId,
        @Valid @RequestBody AdjustmentRequest body,
        @AuthenticationPrincipal CurrentPrincipal principal,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        service.adjust(productId, body.delta(), body.reason(), principal, requestId);
        return ApiResponse.success(
            requestId,
            Map.of("availableQuantity", service.current(productId))
        );
    }

    record AdjustmentRequest(int delta, @NotBlank String reason) {
    }
}
