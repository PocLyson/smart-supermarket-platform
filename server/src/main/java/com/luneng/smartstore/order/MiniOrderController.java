package com.luneng.smartstore.order;

import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.common.api.ApiResponse;
import com.luneng.smartstore.common.api.PageResult;
import com.luneng.smartstore.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mini/orders")
public class MiniOrderController {
    private final OrderApplicationService service;

    public MiniOrderController(OrderApplicationService service) {
        this.service = service;
    }

    @PostMapping
    ApiResponse<OrderView> create(
        @AuthenticationPrincipal CurrentPrincipal principal,
        @RequestHeader("Idempotency-Key") String idempotencyKey,
        @Valid @RequestBody CreateOrderRequest body,
        HttpServletRequest request
    ) {
        CreateOrderCommand command = new CreateOrderCommand(
            principal.id(),
            idempotencyKey,
            body.pickupName(),
            body.phone(),
            body.items().stream()
                .map(item -> new CreateOrderItem(item.productId(), item.quantity()))
                .toList()
        );
        return ApiResponse.success(RequestIdFilter.requestId(request), service.create(command));
    }

    @GetMapping
    ApiResponse<PageResult<OrderView>> list(
        @AuthenticationPrincipal CurrentPrincipal principal,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            PageResult.from(service.list(principal.id(), page, size))
        );
    }

    @GetMapping("/{orderNo}")
    ApiResponse<OrderView> detail(
        @AuthenticationPrincipal CurrentPrincipal principal,
        @PathVariable String orderNo,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            service.detail(principal.id(), orderNo)
        );
    }

    @PostMapping("/{orderNo}/cancel")
    ApiResponse<OrderView> cancel(
        @AuthenticationPrincipal CurrentPrincipal principal,
        @PathVariable String orderNo,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            service.cancelByCustomer(principal.id(), orderNo)
        );
    }
}
