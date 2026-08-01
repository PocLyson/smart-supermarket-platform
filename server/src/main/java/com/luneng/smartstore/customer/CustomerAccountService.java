package com.luneng.smartstore.customer;

import com.luneng.smartstore.common.api.BusinessException;
import com.luneng.smartstore.order.OrderRepository;
import com.luneng.smartstore.order.OrderStatus;
import jakarta.persistence.EntityNotFoundException;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerAccountService {
    private static final List<OrderStatus> ACTIVE_ORDER_STATUSES = List.of(
        OrderStatus.PENDING_CONFIRMATION,
        OrderStatus.PREPARING,
        OrderStatus.READY_FOR_PICKUP
    );

    private final CustomerUserRepository customerRepository;
    private final OrderRepository orderRepository;
    private final StringRedisTemplate redisTemplate;

    public CustomerAccountService(
        CustomerUserRepository customerRepository,
        OrderRepository orderRepository,
        StringRedisTemplate redisTemplate
    ) {
        this.customerRepository = customerRepository;
        this.orderRepository = orderRepository;
        this.redisTemplate = redisTemplate;
    }

    @Transactional
    public void delete(long customerId) {
        CustomerUser customer = customerRepository.findById(customerId)
            .orElseThrow(EntityNotFoundException::new);
        if (orderRepository.existsByCustomerIdAndStatusIn(
            customerId,
            ACTIVE_ORDER_STATUSES
        )) {
            throw new BusinessException(
                "ACCOUNT_HAS_ACTIVE_ORDERS",
                "存在未完成订单，请完成或取消后再注销账号",
                HttpStatus.CONFLICT
            );
        }

        customer.deactivate(
            "deleted:" + customerId + ":" + UUID.randomUUID()
        );
        invalidateSessions(customerId);
    }

    private void invalidateSessions(long customerId) {
        String sessionIndexKey = "auth:customer-sessions:" + customerId;
        Set<String> sessionIds = redisTemplate.opsForSet().members(sessionIndexKey);
        if (sessionIds != null && !sessionIds.isEmpty()) {
            redisTemplate.delete(
                sessionIds.stream().map(id -> "auth:session:" + id).toList()
            );
        }
        redisTemplate.delete(sessionIndexKey);
    }
}
