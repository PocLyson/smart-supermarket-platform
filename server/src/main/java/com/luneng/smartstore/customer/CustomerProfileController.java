package com.luneng.smartstore.customer;

import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.common.api.ApiResponse;
import com.luneng.smartstore.common.web.RequestIdFilter;
import jakarta.persistence.EntityNotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mini/profile")
public class CustomerProfileController {
    private final CustomerUserRepository repository;

    public CustomerProfileController(CustomerUserRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    ApiResponse<ProfileView> profile(
        @AuthenticationPrincipal CurrentPrincipal principal,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            ProfileView.from(customer(principal.id()))
        );
    }

    @PutMapping
    @Transactional
    ApiResponse<ProfileView> update(
        @AuthenticationPrincipal CurrentPrincipal principal,
        @Valid @RequestBody CustomerProfileRequest body,
        HttpServletRequest request
    ) {
        CustomerUser customer = customer(principal.id());
        customer.updateProfile(body.pickupName().trim(), body.phone());
        return ApiResponse.success(RequestIdFilter.requestId(request), ProfileView.from(customer));
    }

    private CustomerUser customer(long id) {
        return repository.findById(id).orElseThrow(EntityNotFoundException::new);
    }

    record ProfileView(
        long id,
        String nickname,
        String avatarUrl,
        String pickupName,
        String phone,
        boolean profileComplete
    ) {
        static ProfileView from(CustomerUser customer) {
            return new ProfileView(
                customer.getId(),
                customer.getNickname(),
                customer.getAvatarUrl(),
                customer.getPickupName(),
                customer.getPhone(),
                customer.profileComplete()
            );
        }
    }
}
