package com.luneng.smartstore.order;

import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
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

    Page<CustomerOrder> findAllByCustomerIdAndCustomerHiddenFalse(
        long customerId,
        Pageable pageable
    );

    boolean existsByCustomerIdAndStatusIn(
        long customerId,
        Collection<OrderStatus> statuses
    );

    long countByStatusAndAdminHiddenFalse(OrderStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from CustomerOrder o where o.orderNo = :orderNo")
    Optional<CustomerOrder> findLockedByOrderNo(@Param("orderNo") String orderNo);

    @EntityGraph(attributePaths = "items")
    @Query("""
        select o from CustomerOrder o
        where o.orderNo = :orderNo
          and o.customerHidden = false
        """)
    Optional<CustomerOrder> findCustomerDetailedByOrderNo(@Param("orderNo") String orderNo);

    @EntityGraph(attributePaths = "items")
    @Query("""
        select o from CustomerOrder o
        where o.orderNo = :orderNo
        """)
    Optional<CustomerOrder> findAdminDetailedByOrderNo(@Param("orderNo") String orderNo);

    @EntityGraph(attributePaths = "items")
    @Query("""
        select o from CustomerOrder o
        where o.pickupCode = :pickupCode
          and o.status = com.luneng.smartstore.order.OrderStatus.READY_FOR_PICKUP
        """)
    List<CustomerOrder> findReadyForPickupByCode(@Param("pickupCode") String pickupCode);

    @Query("""
        select o from CustomerOrder o
        where o.adminHidden = :archived
          and (:status is null or o.status = :status)
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
        @Param("archived") boolean archived,
        Pageable pageable
    );
}
