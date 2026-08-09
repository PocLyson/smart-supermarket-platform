package com.luneng.smartstore.order;

import java.security.SecureRandom;
import org.springframework.stereotype.Component;

@Component
class PickupCodeGenerator {
    private static final int CODE_SPACE = 1_000_000;
    private static final int CODE_LENGTH = 6;

    private final SecureRandom random = new SecureRandom();

    String next() {
        int value = random.nextInt(CODE_SPACE);
        char[] digits = new char[CODE_LENGTH];
        for (int index = CODE_LENGTH - 1; index >= 0; index--) {
            digits[index] = (char) ('0' + value % 10);
            value /= 10;
        }
        return new String(digits);
    }
}
