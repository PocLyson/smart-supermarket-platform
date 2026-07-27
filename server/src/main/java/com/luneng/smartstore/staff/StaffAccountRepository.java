package com.luneng.smartstore.staff;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StaffAccountRepository extends JpaRepository<StaffAccount, Long> {
    Optional<StaffAccount> findByUsernameAndEnabledTrue(String username);

    boolean existsByUsername(String username);
}
