package com.luneng.smartstore.order;

import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.common.api.ApiResponse;
import com.luneng.smartstore.common.api.PageResult;
import com.luneng.smartstore.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/orders")
public class AdminOrderController {
    private final AdminOrderService service;

    public AdminOrderController(AdminOrderService service) {
        this.service = service;
    }

    @GetMapping
    ApiResponse<PageResult<OrderView>> list(
        @RequestParam(required = false) OrderStatus status,
        @RequestParam(required = false) PaymentStatus paymentStatus,
        @RequestParam(defaultValue = "") String keyword,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            PageResult.from(service.list(status, paymentStatus, keyword, page, size))
        );
    }

    @GetMapping("/{orderNo}")
    ApiResponse<OrderView> detail(
        @PathVariable String orderNo,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            service.detail(orderNo)
        );
    }

    @PostMapping("/{orderNo}/accept")
    ApiResponse<OrderView> accept(
        @PathVariable String orderNo,
        @AuthenticationPrincipal CurrentPrincipal actor,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(requestId, service.accept(orderNo, actor, requestId));
    }

    @PostMapping("/{orderNo}/reject")
    ApiResponse<OrderView> reject(
        @PathVariable String orderNo,
        @Valid @RequestBody ReasonRequest body,
        @AuthenticationPrincipal CurrentPrincipal actor,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(
            requestId,
            service.reject(orderNo, body.reason(), actor, requestId)
        );
    }

    @PostMapping("/{orderNo}/ready")
    ApiResponse<OrderView> ready(
        @PathVariable String orderNo,
        @AuthenticationPrincipal CurrentPrincipal actor,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(requestId, service.markReady(orderNo, actor, requestId));
    }

    @PostMapping("/{orderNo}/pay")
    ApiResponse<OrderView> pay(
        @PathVariable String orderNo,
        @RequestBody PayRequest body,
        @AuthenticationPrincipal CurrentPrincipal actor,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(
            requestId,
            service.markPaid(orderNo, body.method(), actor, requestId)
        );
    }

    @PostMapping("/{orderNo}/complete")
    ApiResponse<OrderView> complete(
        @PathVariable String orderNo,
        @AuthenticationPrincipal CurrentPrincipal actor,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(requestId, service.complete(orderNo, actor, requestId));
    }

    @PostMapping("/{orderNo}/cancel")
    ApiResponse<OrderView> cancel(
        @PathVariable String orderNo,
        @Valid @RequestBody ReasonRequest body,
        @AuthenticationPrincipal CurrentPrincipal actor,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(
            requestId,
            service.cancel(orderNo, body.reason(), actor, requestId)
        );
    }

    record ReasonRequest(@NotBlank String reason) {
    }

    record PayRequest(PaymentMethod method) {
    }
}
