package com.luneng.smartstore.order;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public record CreateOrderRequest(
    @NotBlank @Size(max = 40) String pickupName,
    @NotBlank @Pattern(regexp = "^1\\d{10}$") String phone,
    String customerNote,
    @NotEmpty List<@Valid Item> items
) {
    public record Item(@NotNull Long productId, @Min(1) int quantity) {
    }
}
