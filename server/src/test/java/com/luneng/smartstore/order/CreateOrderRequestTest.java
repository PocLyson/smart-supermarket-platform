package com.luneng.smartstore.order;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.List;
import org.junit.jupiter.api.Test;

class CreateOrderRequestTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void acceptsOneHundredCharacterCustomerNoteWithLeadingAndTrailingWhitespace() {
        String note = "备".repeat(100);

        assertThat(validator.validate(new CreateOrderRequest(
            "李先生",
            "13800138000",
            "  " + note + "  ",
            List.of(new CreateOrderRequest.Item(10L, 1))
        ))).isEmpty();
    }

    @Test
    void acceptsOverlongBlankCustomerNoteForAggregateNormalization() {
        assertThat(validator.validate(new CreateOrderRequest(
            "李先生",
            "13800138000",
            " ".repeat(101),
            List.of(new CreateOrderRequest.Item(10L, 1))
        ))).isEmpty();
    }
}
