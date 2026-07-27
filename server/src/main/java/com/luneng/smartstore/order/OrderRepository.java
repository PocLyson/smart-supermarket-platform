package com.luneng.smartstore.order;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderRepository extends JpaRepository<CustomerOrder, Long> {
    Optional<CustomerOrder> findByOrderNo(String orderNo);

    Optional<CustomerOrder> findByCustomerIdAndIdempotencyKey(
        long customerId,
        String idempotencyKey
    );

    Page<CustomerOrder> findAllByCustomerId(long customerId, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from CustomerOrder o where o.orderNo = :orderNo")
    Optional<CustomerOrder> findLockedByOrderNo(@Param("orderNo") String orderNo);

    @EntityGraph(attributePaths = "items")
    @Query("select o from CustomerOrder o where o.orderNo = :orderNo")
    Optional<CustomerOrder> findDetailedByOrderNo(@Param("orderNo") String orderNo);
}
