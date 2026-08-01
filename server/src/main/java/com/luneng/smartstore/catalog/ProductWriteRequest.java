package com.luneng.smartstore.catalog;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record ProductWriteRequest(
    @NotBlank String name,
    @NotNull Long categoryId,
    @PositiveOrZero long priceCent,
    @NotBlank String unit,
    String coverImageUrl,
    String description,
    boolean onShelf,
    @PositiveOrZero Integer initialStock
) {
}
