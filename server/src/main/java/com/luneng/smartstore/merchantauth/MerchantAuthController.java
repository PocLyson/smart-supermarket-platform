package com.luneng.smartstore.merchantauth;

import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.common.api.ApiResponse;
import com.luneng.smartstore.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/merchant-mini")
public class MerchantAuthController {
    private final MerchantAuthService authService;

    public MerchantAuthController(MerchantAuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/auth/password-login")
    ApiResponse<MerchantAuthService.MerchantSessionView> passwordLogin(
        @Valid @RequestBody PasswordLoginRequest request,
        HttpServletRequest servletRequest
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(servletRequest),
            authService.passwordLogin(request.username(), request.password(), request.code())
        );
    }

    @PostMapping("/auth/wechat-login")
    ApiResponse<MerchantAuthService.MerchantSessionView> wechatLogin(
        @Valid @RequestBody WechatLoginRequest request,
        HttpServletRequest servletRequest
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(servletRequest),
            authService.wechatLogin(request.code())
        );
    }

    @PostMapping("/auth/logout")
    ApiResponse<Void> logout(
        @AuthenticationPrincipal CurrentPrincipal principal,
        HttpServletRequest servletRequest
    ) {
        authService.logout(principal);
        return ApiResponse.success(RequestIdFilter.requestId(servletRequest), null);
    }

    @GetMapping("/account")
    ApiResponse<MerchantAuthService.MerchantSessionView> account(
        @AuthenticationPrincipal CurrentPrincipal principal,
        HttpServletRequest servletRequest
    ) {
        return ApiResponse.success(RequestIdFilter.requestId(servletRequest), authService.account(principal));
    }

    @DeleteMapping("/account/wechat-binding")
    ApiResponse<Void> unbind(
        @AuthenticationPrincipal CurrentPrincipal principal,
        HttpServletRequest servletRequest
    ) {
        authService.unbind(principal);
        return ApiResponse.success(RequestIdFilter.requestId(servletRequest), null);
    }

    record PasswordLoginRequest(@NotBlank String username, @NotBlank String password, @NotBlank String code) {
    }

    record WechatLoginRequest(@NotBlank String code) {
    }
}
