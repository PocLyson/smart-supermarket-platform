package com.luneng.smartstore.merchant;

import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.common.api.ApiResponse;
import com.luneng.smartstore.common.api.PageResult;
import com.luneng.smartstore.common.web.RequestIdFilter;
import com.luneng.smartstore.order.AdminOrderView;
import com.luneng.smartstore.order.OrderStatus;
import com.luneng.smartstore.order.PaymentMethod;
import com.luneng.smartstore.order.PaymentStatus;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/merchant-mini/orders")
public class MerchantOrderController {
    private final MerchantOrderService service;

    public MerchantOrderController(MerchantOrderService service) {
        this.service = service;
    }

    @GetMapping
    ApiResponse<PageResult<AdminOrderView>> list(
        @RequestParam(required = false) OrderStatus status,
        @RequestParam(required = false) PaymentStatus paymentStatus,
        @RequestParam(defaultValue = "") String keyword,
        @RequestParam(defaultValue = "false") boolean archived,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            PageResult.from(service.list(
                status, paymentStatus, keyword, archived, page, size
            ))
        );
    }

    @GetMapping("/{orderNo}")
    ApiResponse<AdminOrderView> detail(
        @PathVariable String orderNo,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            service.detail(orderNo)
        );
    }

    @GetMapping("/pickup-preview")
    ApiResponse<AdminOrderView> pickupPreview(
        @RequestParam
        @Pattern(regexp = "\\d{6}", message = "取件码必须为6位数字")
        String pickupCode,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            service.pickupPreview(pickupCode)
        );
    }

    @PostMapping("/{orderNo}/accept")
    ApiResponse<AdminOrderView> accept(
        @PathVariable String orderNo,
        @AuthenticationPrincipal CurrentPrincipal actor,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(requestId, service.accept(orderNo, actor, requestId));
    }

    @PostMapping("/{orderNo}/ready")
    ApiResponse<AdminOrderView> ready(
        @PathVariable String orderNo,
        @AuthenticationPrincipal CurrentPrincipal actor,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(requestId, service.markReady(orderNo, actor, requestId));
    }

    @PostMapping("/{orderNo}/pay")
    ApiResponse<AdminOrderView> pay(
        @PathVariable String orderNo,
        @Valid @RequestBody PayRequest body,
        @AuthenticationPrincipal CurrentPrincipal actor,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(
            requestId,
            service.markPaid(orderNo, body.method(), actor, requestId)
        );
    }

    @PostMapping("/{orderNo}/cancel")
    ApiResponse<AdminOrderView> cancel(
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

    @PostMapping("/{orderNo}/verify-pickup")
    ApiResponse<AdminOrderView> verifyPickup(
        @PathVariable String orderNo,
        @Valid @RequestBody VerifyPickupRequest body,
        @AuthenticationPrincipal CurrentPrincipal actor,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(
            requestId,
            service.verifyPickup(
                orderNo,
                body.pickupCode(),
                body.payAtStoreMethod(),
                actor,
                requestId
            )
        );
    }

    record ReasonRequest(@NotBlank String reason) {
    }

    record PayRequest(@NotNull PaymentMethod method) {
    }

    record VerifyPickupRequest(
        @NotBlank
        @Pattern(regexp = "\\d{6}", message = "取件码必须为6位数字")
        String pickupCode,
        @NotNull PaymentMethod payAtStoreMethod
    ) {
    }
}
