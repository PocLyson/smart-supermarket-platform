package com.luneng.smartstore.support;

import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.common.api.ApiResponse;
import com.luneng.smartstore.common.api.PageResult;
import com.luneng.smartstore.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/merchant-mini/support")
public class MerchantSupportController {
    private final SupportChatService service;

    public MerchantSupportController(SupportChatService service) {
        this.service = service;
    }

    @GetMapping("/conversations")
    ApiResponse<PageResult<SupportConversationView>> conversations(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            PageResult.from(service.merchantConversations(page, size))
        );
    }

    @GetMapping("/conversations/{conversationId}/messages")
    ApiResponse<List<SupportMessageView>> messages(
        @PathVariable long conversationId,
        @RequestParam(defaultValue = "0") long afterId,
        @RequestParam(defaultValue = "50") int size,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            service.merchantMessages(conversationId, afterId, size)
        );
    }

    @PostMapping("/conversations/{conversationId}/messages")
    ApiResponse<SupportMessageView> send(
        @AuthenticationPrincipal CurrentPrincipal principal,
        @PathVariable long conversationId,
        @Valid @RequestBody SupportSendMessageRequest body,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            service.sendByMerchant(principal.id(), conversationId, body)
        );
    }

    @PostMapping("/conversations/{conversationId}/read")
    ApiResponse<SupportConversationView> read(
        @PathVariable long conversationId,
        @Valid @RequestBody SupportReadRequest body,
        HttpServletRequest request
    ) {
        return ApiResponse.success(
            RequestIdFilter.requestId(request),
            service.markMerchantRead(conversationId, body.lastMessageId())
        );
    }
}
