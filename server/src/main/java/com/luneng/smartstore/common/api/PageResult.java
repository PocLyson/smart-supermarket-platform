package com.luneng.smartstore.common.api;

import java.util.List;
import org.springframework.data.domain.Page;

public record PageResult<T>(
    List<T> items,
    long total,
    int page,
    int size
) {
    public static <T> PageResult<T> from(Page<T> source) {
        return new PageResult<>(
            source.getContent(),
            source.getTotalElements(),
            source.getNumber(),
            source.getSize()
        );
    }
}
