package com.luneng.smartstore.announcement;

import com.luneng.smartstore.common.api.ApiResponse;
import com.luneng.smartstore.common.api.PageResult;
import com.luneng.smartstore.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mini/announcements")
public class MiniAnnouncementController {
    private final AnnouncementService service;

    public MiniAnnouncementController(AnnouncementService service) {
        this.service = service;
    }

    @GetMapping("/latest")
    ApiResponse<AnnouncementView> latest(HttpServletRequest request) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request), service.latestPublished().orElse(null)
        );
    }

    @GetMapping
    ApiResponse<PageResult<AnnouncementView>> list(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request), PageResult.from(service.listPublished(page, size))
        );
    }

    @GetMapping("/{id}")
    ApiResponse<AnnouncementView> detail(@PathVariable long id, HttpServletRequest request) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request), service.detailPublished(id)
        );
    }
}
