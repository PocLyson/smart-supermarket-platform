package com.luneng.smartstore.customer;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CustomerUserRepository extends JpaRepository<CustomerUser, Long> {
    Optional<CustomerUser> findByOpenid(String openid);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select customer from CustomerUser customer where customer.id = :id")
    Optional<CustomerUser> findByIdForUpdate(@Param("id") long id);
}
