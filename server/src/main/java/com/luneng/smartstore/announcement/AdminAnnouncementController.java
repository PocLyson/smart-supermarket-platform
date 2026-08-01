package com.luneng.smartstore.announcement;

import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.common.api.ApiResponse;
import com.luneng.smartstore.common.api.PageResult;
import com.luneng.smartstore.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/announcements")
public class AdminAnnouncementController {
    private final AnnouncementService service;

    public AdminAnnouncementController(AnnouncementService service) {
        this.service = service;
    }

    @GetMapping
    ApiResponse<PageResult<AnnouncementView>> list(
        @RequestParam(required = false) AnnouncementStatus status,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @AuthenticationPrincipal CurrentPrincipal actor,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            PageResult.from(service.listAdmin(status, page, size, actor))
        );
    }

    @PostMapping
    ApiResponse<AnnouncementView> create(
        @Valid @RequestBody AnnouncementWriteRequest body,
        @AuthenticationPrincipal CurrentPrincipal actor,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(requestId, service.create(body, actor, requestId));
    }

    @GetMapping("/{id}")
    ApiResponse<AnnouncementView> detail(
        @PathVariable long id,
        @AuthenticationPrincipal CurrentPrincipal actor,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request), service.detailAdmin(id, actor)
        );
    }

    @PutMapping("/{id}")
    ApiResponse<AnnouncementView> update(
        @PathVariable long id,
        @Valid @RequestBody AnnouncementWriteRequest body,
        @AuthenticationPrincipal CurrentPrincipal actor,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(requestId, service.update(id, body, actor, requestId));
    }

    @PostMapping("/{id}/publish")
    ApiResponse<AnnouncementView> publish(
        @PathVariable long id,
        @AuthenticationPrincipal CurrentPrincipal actor,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(requestId, service.publish(id, actor, requestId));
    }

    @PostMapping("/{id}/offline")
    ApiResponse<AnnouncementView> offline(
        @PathVariable long id,
        @AuthenticationPrincipal CurrentPrincipal actor,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(requestId, service.offline(id, actor, requestId));
    }

    @DeleteMapping("/{id}")
    ApiResponse<DeleteAnnouncementResult> delete(
        @PathVariable long id,
        @AuthenticationPrincipal CurrentPrincipal actor,
        HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.requestId(request);
        return ApiResponse.success(
            requestId, new DeleteAnnouncementResult(service.delete(id, actor, requestId))
        );
    }

    record DeleteAnnouncementResult(boolean deleted) {
    }
}
