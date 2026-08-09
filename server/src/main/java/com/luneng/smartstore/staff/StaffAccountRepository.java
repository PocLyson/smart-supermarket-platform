package com.luneng.smartstore.staff;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StaffAccountRepository extends JpaRepository<StaffAccount, Long> {
    Optional<StaffAccount> findByUsernameAndEnabledTrue(String username);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select staff from StaffAccount staff where staff.username = :username and staff.enabled = true")
    Optional<StaffAccount> findEnabledByUsernameForUpdate(@Param("username") String username);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select staff from StaffAccount staff where staff.id = :id")
    Optional<StaffAccount> findByIdForUpdate(@Param("id") long id);

    boolean existsByUsername(String username);
}
