package com.luneng.smartstore.merchantauth;

import com.luneng.smartstore.auth.ActorType;
import com.luneng.smartstore.auth.ClientType;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.auth.JwtService;
import com.luneng.smartstore.auth.MerchantSessionStore;
import com.luneng.smartstore.common.api.BusinessException;
import com.luneng.smartstore.staff.StaffAccount;
import com.luneng.smartstore.staff.StaffAccountRepository;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MerchantAuthService {
    private final StaffAccountRepository staffRepository;
    private final StaffWechatBindingRepository bindingRepository;
    private final MerchantWechatSessionClient wechatSessionClient;
    private final PasswordEncoder passwordEncoder;
    private final MerchantSessionStore sessionStore;
    private final JwtService jwtService;
    private final String appId;

    public MerchantAuthService(
        StaffAccountRepository staffRepository,
        StaffWechatBindingRepository bindingRepository,
        MerchantWechatSessionClient wechatSessionClient,
        PasswordEncoder passwordEncoder,
        MerchantSessionStore sessionStore,
        JwtService jwtService,
        @Value("${smart-store.merchant-wechat.app-id}") String appId
    ) {
        this.staffRepository = staffRepository;
        this.bindingRepository = bindingRepository;
        this.wechatSessionClient = wechatSessionClient;
        this.passwordEncoder = passwordEncoder;
        this.sessionStore = sessionStore;
        this.jwtService = jwtService;
        this.appId = appId;
    }

    @Transactional
    public MerchantSessionView passwordLogin(String username, String rawPassword, String code) {
        StaffAccount staff = staffRepository.findEnabledByUsernameForUpdate(username)
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
        long staffId = bindingRepository.findEnabledStaffId(appId, wechatSession.openid())
            .orElseThrow(this::notBound);
        StaffAccount staff = staffRepository.findByIdForUpdate(staffId)
            .filter(StaffAccount::isEnabled)
            .orElseThrow(this::notBound);
        StaffWechatBinding binding = bindingRepository
            .findByAppIdAndOpenidAndEnabledTrue(appId, wechatSession.openid())
            .filter(candidate -> candidate.getStaff().getId().equals(staff.getId()))
            .orElseThrow(this::notBound);
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
        sessionStore.revokeExpected(principal.id(), principal.sessionId());
    }

    @Transactional
    public void unbind(CurrentPrincipal principal) {
        staffRepository.findByIdForUpdate(principal.id())
            .orElseThrow(this::notBound);
        StaffWechatBinding binding = bindingRepository.findByStaff_Id(principal.id())
            .filter(StaffWechatBinding::isEnabled)
            .orElseThrow(this::notBound);
        binding.unbind(Instant.now());
        sessionStore.revokeCurrent(principal.id());
    }

    public void invalidateMerchantSession(long staffId) {
        sessionStore.revokeCurrent(staffId);
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
        String sessionId = sessionStore.replace(staff.getId());
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
