package com.luneng.smartstore.customer;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CustomerProfileRequest(
    @NotBlank @Size(max = 40) String pickupName,
    @NotBlank @Pattern(regexp = "^1\\d{10}$") String phone
) {
}
