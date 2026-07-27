package com.luneng.smartstore.file;

import com.luneng.smartstore.common.api.ApiResponse;
import com.luneng.smartstore.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin/files")
public class AdminImageController {
    private final ImageStorageService service;

    public AdminImageController(ImageStorageService service) {
        this.service = service;
    }

    @PostMapping("/images")
    ApiResponse<ImageStorageService.ImageUploadResponse> upload(
        @RequestParam("file") MultipartFile file,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            service.store(file)
        );
    }
}
