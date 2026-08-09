package com.luneng.smartstore.merchant;

import com.luneng.smartstore.common.api.ApiResponse;
import com.luneng.smartstore.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/merchant-mini/dashboard")
public class MerchantDashboardController {
    private final MerchantDashboardService service;

    public MerchantDashboardController(MerchantDashboardService service) {
        this.service = service;
    }

    @GetMapping
    ApiResponse<MerchantDashboardService.DashboardView> dashboard(
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            service.dashboard()
        );
    }
}
