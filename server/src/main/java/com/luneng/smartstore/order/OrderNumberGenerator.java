package com.luneng.smartstore.order;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import org.springframework.stereotype.Component;

@Component
public class OrderNumberGenerator {
    private static final DateTimeFormatter FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private final SecureRandom random = new SecureRandom();

    public String next() {
        return FORMAT.format(LocalDateTime.now()) + String.format("%06d", random.nextInt(1_000_000));
    }
}
