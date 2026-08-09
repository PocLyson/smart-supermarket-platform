package com.luneng.smartstore.merchantauth;

import com.luneng.smartstore.auth.ActorType;
import com.luneng.smartstore.auth.ClientType;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.auth.JwtService;
import com.luneng.smartstore.common.api.BusinessException;
import com.luneng.smartstore.staff.StaffAccount;
import com.luneng.smartstore.staff.StaffAccountRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MerchantAuthService {
    private static final String STAFF_SESSION_PREFIX = "auth:merchant-staff:";
    private static final String SESSION_PREFIX = "auth:session:";
    private static final DefaultRedisScript<String> REPLACE_SESSION_SCRIPT = new DefaultRedisScript<>(
        "local previous = redis.call('GET', KEYS[1]); "
            + "if previous then redis.call('DEL', ARGV[1] .. previous); end; "
            + "redis.call('SET', ARGV[1] .. ARGV[2], ARGV[3], 'PX', ARGV[4]); "
            + "redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[4]); "
            + "return previous;",
        String.class
    );

    private final StaffAccountRepository staffRepository;
    private final StaffWechatBindingRepository bindingRepository;
    private final MerchantWechatSessionClient wechatSessionClient;
    private final PasswordEncoder passwordEncoder;
    private final StringRedisTemplate redisTemplate;
    private final JwtService jwtService;
    private final String appId;

    public MerchantAuthService(
        StaffAccountRepository staffRepository,
        StaffWechatBindingRepository bindingRepository,
        MerchantWechatSessionClient wechatSessionClient,
        PasswordEncoder passwordEncoder,
        StringRedisTemplate redisTemplate,
        JwtService jwtService,
        @Value("${smart-store.merchant-wechat.app-id}") String appId
    ) {
        this.staffRepository = staffRepository;
        this.bindingRepository = bindingRepository;
        this.wechatSessionClient = wechatSessionClient;
        this.passwordEncoder = passwordEncoder;
        this.redisTemplate = redisTemplate;
        this.jwtService = jwtService;
        this.appId = appId;
    }

    @Transactional
    public MerchantSessionView passwordLogin(String username, String rawPassword, String code) {
        StaffAccount staff = staffRepository.findByUsernameAndEnabledTrue(username)
            .orElseThrow(this::invalidCredentials);
        if (!passwordEncoder.matches(rawPassword, staff.getPasswordHash())) {
            throw invalidCredentials();
        }
        MerchantWechatSessionClient.WechatSession wechatSession = wechatSessionClient.exchange(code);
        bindOrVerify(staff, wechatSession.openid());
        staff.recordLogin(Instant.now());
        return createSession(staff);
    }

    @Transactional
    public MerchantSessionView wechatLogin(String code) {
        MerchantWechatSessionClient.WechatSession wechatSession = wechatSessionClient.exchange(code);
        StaffWechatBinding binding = bindingRepository
            .findByAppIdAndOpenidAndEnabledTrue(appId, wechatSession.openid())
            .orElseThrow(this::notBound);
        StaffAccount staff = binding.getStaff();
        if (!staff.isEnabled()) {
            throw notBound();
        }
        Instant now = Instant.now();
        binding.recordLogin(now);
        staff.recordLogin(now);
        return createSession(staff);
    }

    @Transactional(readOnly = true)
    public MerchantSessionView account(CurrentPrincipal principal) {
        StaffAccount staff = staffRepository.findById(principal.id())
            .filter(StaffAccount::isEnabled)
            .orElseThrow(this::notBound);
        return new MerchantSessionView(null, staff.getRole(), staff.getId(), staff.getUsername(), null);
    }

    public void logout(CurrentPrincipal principal) {
        invalidateMerchantSession(principal.id(), principal.sessionId());
    }

    @Transactional
    public void unbind(CurrentPrincipal principal) {
        StaffWechatBinding binding = bindingRepository.findByStaff_Id(principal.id())
            .filter(StaffWechatBinding::isEnabled)
            .orElseThrow(this::notBound);
        binding.unbind(Instant.now());
        invalidateMerchantSession(principal.id(), principal.sessionId());
    }

    public void invalidateMerchantSession(long staffId) {
        String key = STAFF_SESSION_PREFIX + staffId;
        String sessionId = redisTemplate.opsForValue().get(key);
        if (sessionId != null) {
            redisTemplate.delete(SESSION_PREFIX + sessionId);
        }
        redisTemplate.delete(key);
    }

    private void bindOrVerify(StaffAccount staff, String openid) {
        Instant now = Instant.now();
        StaffWechatBinding staffBinding = bindingRepository.findByStaff_Id(staff.getId()).orElse(null);
        if (staffBinding != null && staffBinding.isEnabled()) {
            if (!staffBinding.getAppId().equals(appId) || !staffBinding.getOpenid().equals(openid)) {
                throw new BusinessException(
                    "STAFF_WECHAT_ALREADY_BOUND",
                    "该员工账号已绑定其他微信，请先解绑",
                    HttpStatus.CONFLICT
                );
            }
            staffBinding.recordLogin(now);
            return;
        }

        StaffWechatBinding openidBinding = bindingRepository
            .findByAppIdAndOpenidAndEnabledTrue(appId, openid)
            .orElse(null);
        if (openidBinding != null && !openidBinding.getStaff().getId().equals(staff.getId())) {
            throw new BusinessException(
                "WECHAT_ALREADY_BOUND",
                "该微信已绑定其他员工账号",
                HttpStatus.CONFLICT
            );
        }
        if (staffBinding != null) {
            staffBinding.rebind(appId, openid, now);
        } else {
            bindingRepository.save(new StaffWechatBinding(staff, appId, openid, now));
        }
    }

    private MerchantSessionView createSession(StaffAccount staff) {
        String sessionId = UUID.randomUUID().toString();
        redisTemplate.execute(
            REPLACE_SESSION_SCRIPT,
            List.of(STAFF_SESSION_PREFIX + staff.getId()),
            SESSION_PREFIX,
            sessionId,
            Long.toString(staff.getId()),
            Long.toString(JwtService.TOKEN_TTL.toMillis())
        );
        String accessToken = jwtService.issue(new CurrentPrincipal(
            staff.getId(), ActorType.STAFF, staff.getRole(), sessionId, ClientType.MERCHANT_MINI
        ));
        return new MerchantSessionView(
            accessToken,
            staff.getRole(),
            staff.getId(),
            staff.getUsername(),
            Instant.now().plus(JwtService.TOKEN_TTL)
        );
    }

    private void invalidateMerchantSession(long staffId, String expectedSessionId) {
        String key = STAFF_SESSION_PREFIX + staffId;
        String indexedSessionId = redisTemplate.opsForValue().get(key);
        if (expectedSessionId.equals(indexedSessionId)) {
            redisTemplate.delete(SESSION_PREFIX + expectedSessionId);
            redisTemplate.delete(key);
        } else {
            redisTemplate.delete(SESSION_PREFIX + expectedSessionId);
        }
    }

    private BusinessException invalidCredentials() {
        return new BusinessException("INVALID_CREDENTIALS", "用户名或密码错误", HttpStatus.UNAUTHORIZED);
    }

    private BusinessException notBound() {
        return new BusinessException("MERCHANT_NOT_BOUND", "该微信尚未绑定员工账号", HttpStatus.NOT_FOUND);
    }

    public record MerchantSessionView(
        String accessToken,
        String role,
        long staffId,
        String username,
        Instant expiresAt
    ) {
    }
}
