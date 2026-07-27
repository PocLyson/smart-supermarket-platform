package com.luneng.smartstore.audit;

import com.luneng.smartstore.common.api.ApiResponse;
import com.luneng.smartstore.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/audit-logs")
public class AdminAuditController {
    private final AuditService service;

    public AdminAuditController(AuditService service) {
        this.service = service;
    }

    @GetMapping
    ApiResponse<AuditService.AuditPage> list(
        @RequestParam(required = false) Long actorId,
        @RequestParam(defaultValue = "") String action,
        @RequestParam(defaultValue = "") String objectType,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            service.list(actorId, action, objectType, page, size)
        );
    }
}
