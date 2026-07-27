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

    @Query("""
        select o from CustomerOrder o
        where (:status is null or o.status = :status)
          and (:paymentStatus is null or o.paymentStatus = :paymentStatus)
          and (
            :keyword = ''
            or lower(o.orderNo) like lower(concat('%', :keyword, '%'))
            or lower(o.pickupName) like lower(concat('%', :keyword, '%'))
            or o.phone like concat('%', :keyword, '%')
          )
        """)
    Page<CustomerOrder> searchAdmin(
        @Param("status") OrderStatus status,
        @Param("paymentStatus") PaymentStatus paymentStatus,
        @Param("keyword") String keyword,
        Pageable pageable
    );
}
