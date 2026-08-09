package com.luneng.smartstore.auth;

import java.util.List;
import java.util.UUID;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

@Component
public class MerchantSessionStore {
    private static final String STAFF_SESSION_PREFIX = "auth:merchant-staff:";
    private static final String SESSION_PREFIX = "auth:session:";
    private static final DefaultRedisScript<String> REPLACE_SESSION_SCRIPT =
        new DefaultRedisScript<>(
            "local previous = redis.call('GET', KEYS[1]); "
                + "if previous then redis.call('DEL', ARGV[1] .. previous); end; "
                + "redis.call('SET', ARGV[1] .. ARGV[2], ARGV[3], 'PX', ARGV[4]); "
                + "redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[4]); "
                + "return previous;",
            String.class
        );
    private static final DefaultRedisScript<String> REVOKE_EXPECTED_SCRIPT =
        new DefaultRedisScript<>(
            "local current = redis.call('GET', KEYS[1]); "
                + "redis.call('DEL', ARGV[1] .. ARGV[2]); "
                + "if current == ARGV[2] then redis.call('DEL', KEYS[1]); end; "
                + "return current;",
            String.class
        );
    private static final DefaultRedisScript<String> REVOKE_CURRENT_SCRIPT =
        new DefaultRedisScript<>(
            "local current = redis.call('GET', KEYS[1]); "
                + "if current then redis.call('DEL', ARGV[1] .. current); end; "
                + "redis.call('DEL', KEYS[1]); "
                + "return current;",
            String.class
        );
    private static final DefaultRedisScript<Long> IS_CURRENT_SCRIPT =
        new DefaultRedisScript<>(
            "if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0; end; "
                + "if redis.call('GET', KEYS[2]) ~= ARGV[2] then return 0; end; "
                + "return 1;",
            Long.class
        );

    private final StringRedisTemplate redisTemplate;

    public MerchantSessionStore(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public String replace(long staffId) {
        String sessionId = UUID.randomUUID().toString();
        redisTemplate.execute(
            REPLACE_SESSION_SCRIPT,
            List.of(staffSessionKey(staffId)),
            SESSION_PREFIX,
            sessionId,
            Long.toString(staffId),
            Long.toString(JwtService.TOKEN_TTL.toMillis())
        );
        return sessionId;
    }

    public void revokeExpected(long staffId, String expectedSessionId) {
        redisTemplate.execute(
            REVOKE_EXPECTED_SCRIPT,
            List.of(staffSessionKey(staffId)),
            SESSION_PREFIX,
            expectedSessionId
        );
    }

    public void revokeCurrent(long staffId) {
        redisTemplate.execute(
            REVOKE_CURRENT_SCRIPT,
            List.of(staffSessionKey(staffId)),
            SESSION_PREFIX
        );
    }

    public boolean isCurrent(long staffId, String sessionId) {
        Long current = redisTemplate.execute(
            IS_CURRENT_SCRIPT,
            List.of(staffSessionKey(staffId), SESSION_PREFIX + sessionId),
            sessionId,
            Long.toString(staffId)
        );
        return Long.valueOf(1L).equals(current);
    }

    private String staffSessionKey(long staffId) {
        return STAFF_SESSION_PREFIX + staffId;
    }
}
