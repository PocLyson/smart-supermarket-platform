package com.luneng.smartstore.store;

import com.luneng.smartstore.common.api.ApiResponse;
import com.luneng.smartstore.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mini/store")
@EnableConfigurationProperties(StoreContactProperties.class)
public class StoreContactController {
    private final StoreContactProperties properties;

    public StoreContactController(StoreContactProperties properties) {
        this.properties = properties;
    }

    @GetMapping("/contact")
    ApiResponse<StoreContactView> contact(HttpServletRequest request) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            new StoreContactView(properties.phone(), properties.customerServiceEnabled())
        );
    }
}
