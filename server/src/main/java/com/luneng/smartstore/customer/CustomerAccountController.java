package com.luneng.smartstore.customer;

import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.common.api.ApiResponse;
import com.luneng.smartstore.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mini/account")
public class CustomerAccountController {
    private final CustomerAccountService accountService;

    public CustomerAccountController(CustomerAccountService accountService) {
        this.accountService = accountService;
    }

    @DeleteMapping
    ApiResponse<DeleteAccountResult> delete(
        @AuthenticationPrincipal CurrentPrincipal principal,
        HttpServletRequest request
    ) {
        accountService.delete(principal.id());
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            new DeleteAccountResult(true)
        );
    }

    record DeleteAccountResult(boolean deleted) {
    }
}
