package com.luneng.smartstore.merchantauth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;

import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.auth.JwtService;
import com.luneng.smartstore.auth.MerchantSessionStore;
import com.luneng.smartstore.staff.StaffManagementService;
import com.luneng.smartstore.support.IntegrationTestBase;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

class MerchantAuthConcurrencyTest extends IntegrationTestBase {
    private static final long WAIT_SECONDS = 10;

    @Autowired
    private MerchantAuthService authService;

    @Autowired
    private StaffManagementService staffManagementService;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private MerchantSessionStore sessionStore;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private MerchantWechatSessionClient wechatSessionClient;

    private long ownerId;
    private long cashierId;
    private final CurrentPrincipal owner = new CurrentPrincipal(
        900L,
        com.luneng.smartstore.auth.ActorType.STAFF,
        "OWNER",
        "owner-admin-session"
    );

    @BeforeEach
    void setUp() {
        Set<String> authKeys = redisTemplate.keys("auth:*");
        if (!authKeys.isEmpty()) {
            redisTemplate.delete(authKeys);
        }
        jdbcTemplate.update("delete from operation_log");
        jdbcTemplate.update("delete from staff_wechat_binding");
        jdbcTemplate.update("delete from staff_account");
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        jdbcTemplate.update(
            "insert into staff_account(username, password_hash, role, enabled) values (?, ?, 'OWNER', true)",
            "owner",
            encoder.encode("correct-password")
        );
        jdbcTemplate.update(
            "insert into staff_account(username, password_hash, role, enabled) values (?, ?, 'CASHIER', true)",
            "cashier",
            encoder.encode("cashier-password")
        );
        ownerId = staffId("owner");
        cashierId = staffId("cashier");
    }

    @Test
    void oldLogoutCannotDeleteAConcurrentReplacementSessionIndex() throws Exception {
        for (int attempt = 0; attempt < 32; attempt++) {
            String oldSessionId = sessionStore.replace(ownerId);
            CurrentPrincipal oldPrincipal = new CurrentPrincipal(
                ownerId,
                com.luneng.smartstore.auth.ActorType.STAFF,
                "OWNER",
                oldSessionId,
                com.luneng.smartstore.auth.ClientType.MERCHANT_MINI
            );
            CountDownLatch start = new CountDownLatch(1);
            ExecutorService executor = Executors.newFixedThreadPool(2);
            try {
                Future<?> logout = executor.submit(() -> {
                    start.await();
                    authService.logout(oldPrincipal);
                    return null;
                });
                Future<String> replacement = executor.submit(() -> {
                    start.await();
                    return sessionStore.replace(ownerId);
                });
                start.countDown();
                String replacementSessionId = replacement.get(WAIT_SECONDS, TimeUnit.SECONDS);
                logout.get(WAIT_SECONDS, TimeUnit.SECONDS);

                assertThat(sessionStore.isCurrent(ownerId, replacementSessionId)).isTrue();
            } finally {
                executor.shutdownNow();
            }
        }
    }

    @Test
    void loginRacingWithUnbindCannotLeaveThePreUnbindLoginUsable() throws Exception {
        when(wechatSessionClient.exchange("first-code"))
            .thenReturn(new MerchantWechatSessionClient.WechatSession("owner-openid"));
        MerchantAuthService.MerchantSessionView initial = authService.passwordLogin(
            "owner",
            "correct-password",
            "first-code"
        );
        CurrentPrincipal initialPrincipal = jwtService.parse(initial.accessToken());
        LoginRace race = blockLoginAtWechatExchange("racing-code", "owner-openid");
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<MerchantAuthService.MerchantSessionView> login = executor.submit(() ->
                authService.passwordLogin("owner", "correct-password", "racing-code")
            );
            race.awaitLoginReached();
            CountDownLatch invalidationFinished = new CountDownLatch(1);
            Future<?> unbind = executor.submit(() -> {
                try {
                    authService.unbind(initialPrincipal);
                } finally {
                    invalidationFinished.countDown();
                }
            });
            invalidationFinished.await(500, TimeUnit.MILLISECONDS);
            race.releaseLogin();
            MerchantAuthService.MerchantSessionView result = login.get(WAIT_SECONDS, TimeUnit.SECONDS);
            unbind.get(WAIT_SECONDS, TimeUnit.SECONDS);

            assertSessionRevoked(result, ownerId);
            assertThat(jdbcTemplate.queryForObject(
                "select enabled from staff_wechat_binding where staff_id = ?",
                Boolean.class,
                ownerId
            )).isFalse();
        } finally {
            race.releaseLogin();
            executor.shutdownNow();
        }
    }

    @Test
    void loginRacingWithDisableCannotMintAUsableSessionForDisabledStaff() throws Exception {
        LoginRace race = blockLoginAtWechatExchange("racing-code", "cashier-openid");
        MerchantAuthService.MerchantSessionView result = raceLoginAgainstInvalidation(
            race,
            () -> staffManagementService.setEnabled(
                cashierId,
                false,
                owner,
                "disable-race"
            ),
            "cashier-password"
        );

        assertSessionRevoked(result, cashierId);
        assertThat(jdbcTemplate.queryForObject(
            "select enabled from staff_account where id = ?",
            Boolean.class,
            cashierId
        )).isFalse();
    }

    @Test
    void loginRacingWithPasswordResetCannotMintAUsableOldCredentialSession() throws Exception {
        LoginRace race = blockLoginAtWechatExchange("racing-code", "cashier-openid");
        MerchantAuthService.MerchantSessionView result = raceLoginAgainstInvalidation(
            race,
            () -> staffManagementService.resetPassword(
                cashierId,
                new StaffManagementService.ResetPasswordRequest("replacement-password"),
                owner,
                "password-race"
            ),
            "cashier-password"
        );

        assertSessionRevoked(result, cashierId);
    }

    private MerchantAuthService.MerchantSessionView raceLoginAgainstInvalidation(
        LoginRace race,
        Runnable invalidation,
        String password
    ) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<MerchantAuthService.MerchantSessionView> login = executor.submit(() ->
                authService.passwordLogin("cashier", password, "racing-code")
            );
            race.awaitLoginReached();
            CountDownLatch invalidationFinished = new CountDownLatch(1);
            Future<?> invalidationFuture = executor.submit(() -> {
                try {
                    invalidation.run();
                } finally {
                    invalidationFinished.countDown();
                }
            });
            invalidationFinished.await(500, TimeUnit.MILLISECONDS);
            race.releaseLogin();
            MerchantAuthService.MerchantSessionView result = login.get(
                WAIT_SECONDS,
                TimeUnit.SECONDS
            );
            invalidationFuture.get(WAIT_SECONDS, TimeUnit.SECONDS);
            return result;
        } finally {
            race.releaseLogin();
            executor.shutdownNow();
        }
    }

    private LoginRace blockLoginAtWechatExchange(String code, String openid) {
        LoginRace race = new LoginRace();
        doAnswer(ignored -> {
            race.loginReached.countDown();
            assertThat(race.loginRelease.await(WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();
            return new MerchantWechatSessionClient.WechatSession(openid);
        }).when(wechatSessionClient).exchange(code);
        return race;
    }

    private void assertSessionRevoked(
        MerchantAuthService.MerchantSessionView result,
        long staffId
    ) {
        CurrentPrincipal principal = jwtService.parse(result.accessToken());
        assertThat(redisTemplate.hasKey("auth:session:" + principal.sessionId())).isFalse();
        assertThat(redisTemplate.hasKey("auth:merchant-staff:" + staffId)).isFalse();
    }

    private long staffId(String username) {
        return jdbcTemplate.queryForObject(
            "select id from staff_account where username = ?",
            Long.class,
            username
        );
    }

    private static final class LoginRace {
        private final CountDownLatch loginReached = new CountDownLatch(1);
        private final CountDownLatch loginRelease = new CountDownLatch(1);

        private void awaitLoginReached() throws InterruptedException {
            assertThat(loginReached.await(WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();
        }

        private void releaseLogin() {
            loginRelease.countDown();
        }
    }
}
