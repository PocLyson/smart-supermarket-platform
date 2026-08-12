package com.luneng.smartstore.support;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupportMessageRepository extends JpaRepository<SupportMessage, Long> {
    Optional<SupportMessage> findBySenderTypeAndSenderIdAndClientMessageId(
        SupportSenderType senderType,
        long senderId,
        String clientMessageId
    );

    List<SupportMessage> findByConversationIdAndIdGreaterThanOrderByIdAsc(
        long conversationId,
        long afterId,
        Pageable pageable
    );

    Page<SupportMessage> findByConversationIdOrderByIdDesc(
        long conversationId,
        Pageable pageable
    );
}
