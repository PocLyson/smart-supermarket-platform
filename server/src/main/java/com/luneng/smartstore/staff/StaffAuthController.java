package com.luneng.smartstore.staff;

import com.luneng.smartstore.common.api.ApiResponse;
import com.luneng.smartstore.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/auth")
public class StaffAuthController {
    private final StaffAuthService authService;

    public StaffAuthController(StaffAuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    ApiResponse<StaffAuthService.LoginResult> login(
        @Valid @RequestBody LoginRequest request,
        HttpServletRequest servletRequest
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(servletRequest),
            authService.login(request.username(), request.password())
        );
    }

    public record LoginRequest(
        @NotBlank String username,
        @NotBlank String password
    ) {
    }
}
