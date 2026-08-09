package com.luneng.smartstore.staff;

import com.luneng.smartstore.audit.AuditService;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.common.api.BusinessException;
import jakarta.persistence.EntityNotFoundException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StaffManagementService {
    private final StaffAccountRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;
    private final StringRedisTemplate redisTemplate;

    public StaffManagementService(
        StaffAccountRepository repository,
        PasswordEncoder passwordEncoder,
        AuditService auditService,
        StringRedisTemplate redisTemplate
    ) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
        this.redisTemplate = redisTemplate;
    }

    @Transactional(readOnly = true)
    public List<StaffView> list(CurrentPrincipal actor) {
        requireOwner(actor);
        return repository.findAll().stream().map(StaffView::from).toList();
    }

    @Transactional
    public StaffView createCashier(
        CreateCashierRequest request,
        CurrentPrincipal actor,
        String requestId
    ) {
        requireOwner(actor);
        validate(request.username(), request.password());
        String username = request.username().trim();
        if (repository.existsByUsername(username)) {
            throw new BusinessException("VALIDATION_ERROR", "用户名已存在", HttpStatus.BAD_REQUEST);
        }
        StaffAccount account = repository.save(new StaffAccount(
            username,
            passwordEncoder.encode(request.password()),
            "CASHIER"
        ));
        auditService.record(
            actor,
            "STAFF_CREATE",
            "STAFF",
            account.getId().toString(),
            "创建收银员 " + username,
            requestId
        );
        return StaffView.from(account);
    }

    @Transactional
    public StaffView setEnabled(
        long id,
        boolean enabled,
        CurrentPrincipal actor,
        String requestId
    ) {
        requireOwner(actor);
        StaffAccount account = cashier(id);
        account.setEnabled(enabled);
        if (!enabled) {
            invalidateMerchantSession(id);
        }
        auditService.record(
            actor,
            "STAFF_SET_ENABLED",
            "STAFF",
            Long.toString(id),
            enabled ? "启用" : "停用",
            requestId
        );
        return StaffView.from(account);
    }

    @Transactional
    public StaffView resetPassword(
        long id,
        ResetPasswordRequest request,
        CurrentPrincipal actor,
        String requestId
    ) {
        requireOwner(actor);
        validatePassword(request.password());
        StaffAccount account = cashier(id);
        account.resetPassword(passwordEncoder.encode(request.password()));
        invalidateMerchantSession(id);
        auditService.record(
            actor,
            "STAFF_RESET_PASSWORD",
            "STAFF",
            Long.toString(id),
            "密码已重置",
            requestId
        );
        return StaffView.from(account);
    }

    private StaffAccount cashier(long id) {
        StaffAccount account = repository.findById(id)
            .orElseThrow(EntityNotFoundException::new);
        if (!"CASHIER".equals(account.getRole())) {
            throw new AccessDeniedException("不能管理老板账号");
        }
        return account;
    }

    private void requireOwner(CurrentPrincipal actor) {
        if (actor == null || !"OWNER".equals(actor.role())) {
            throw new AccessDeniedException("仅老板可管理员工");
        }
    }

    private void validate(String username, String password) {
        if (username == null
            || !username.trim().matches("^[A-Za-z0-9._-]{3,64}$")) {
            throw validation("用户名格式不合法");
        }
        validatePassword(password);
    }

    private void validatePassword(String password) {
        if (password == null || password.length() < 8 || password.length() > 72) {
            throw validation("密码长度必须为 8 至 72 位");
        }
    }

    private BusinessException validation(String message) {
        return new BusinessException("VALIDATION_ERROR", message, HttpStatus.BAD_REQUEST);
    }

    private void invalidateMerchantSession(long staffId) {
        String staffSessionKey = "auth:merchant-staff:" + staffId;
        String sessionId = redisTemplate.opsForValue().get(staffSessionKey);
        if (sessionId != null) {
            redisTemplate.delete("auth:session:" + sessionId);
        }
        redisTemplate.delete(staffSessionKey);
    }

    public record CreateCashierRequest(String username, String password) {
    }

    public record ResetPasswordRequest(String password) {
    }

    public record StaffView(long id, String username, String role, boolean enabled) {
        static StaffView from(StaffAccount account) {
            return new StaffView(
                account.getId(),
                account.getUsername(),
                account.getRole(),
                account.isEnabled()
            );
        }
    }
}
