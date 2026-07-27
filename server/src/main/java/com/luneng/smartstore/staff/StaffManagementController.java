package com.luneng.smartstore.staff;

import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.common.api.ApiResponse;
import com.luneng.smartstore.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/staff")
public class StaffManagementController {
    private final StaffManagementService service;

    public StaffManagementController(StaffManagementService service) {
        this.service = service;
    }

    @GetMapping
    ApiResponse<List<StaffManagementService.StaffView>> list(
        @AuthenticationPrincipal CurrentPrincipal actor,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            service.list(actor)
        );
    }

    @PostMapping
    ApiResponse<StaffManagementService.StaffView> create(
        @RequestBody StaffManagementService.CreateCashierRequest body,
        @AuthenticationPrincipal CurrentPrincipal actor,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(
            requestId,
            service.createCashier(body, actor, requestId)
        );
    }

    @PatchMapping("/{id}/enabled")
    ApiResponse<StaffManagementService.StaffView> setEnabled(
        @PathVariable long id,
        @RequestBody EnabledRequest body,
        @AuthenticationPrincipal CurrentPrincipal actor,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(
            requestId,
            service.setEnabled(id, body.enabled(), actor, requestId)
        );
    }

    @PostMapping("/{id}/reset-password")
    ApiResponse<StaffManagementService.StaffView> resetPassword(
        @PathVariable long id,
        @RequestBody StaffManagementService.ResetPasswordRequest body,
        @AuthenticationPrincipal CurrentPrincipal actor,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(
            requestId,
            service.resetPassword(id, body, actor, requestId)
        );
    }

    record EnabledRequest(boolean enabled) {
    }
}
