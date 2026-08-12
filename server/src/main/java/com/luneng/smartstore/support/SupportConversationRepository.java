package com.luneng.smartstore.support;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SupportConversationRepository
    extends JpaRepository<SupportConversation, Long> {
    Optional<SupportConversation> findByCustomerId(long customerId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select conversation from SupportConversation conversation where conversation.id = :id")
    Optional<SupportConversation> findByIdForUpdate(@Param("id") long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select conversation from SupportConversation conversation where conversation.customerId = :customerId")
    Optional<SupportConversation> findByCustomerIdForUpdate(
        @Param("customerId") long customerId
    );

    Page<SupportConversation> findAllByLastMessageAtIsNotNullOrderByLastMessageAtDescIdDesc(
        Pageable pageable
    );

    long countByMerchantUnreadCountGreaterThan(int unreadCount);
}
