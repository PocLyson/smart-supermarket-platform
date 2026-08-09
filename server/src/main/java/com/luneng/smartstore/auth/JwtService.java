package com.luneng.smartstore.auth;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
    public static final Duration TOKEN_TTL = Duration.ofHours(2);

    private final JwtEncoder encoder;
    private final JwtDecoder decoder;

    public JwtService(@Value("${smart-store.jwt.secret}") String secret) {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalArgumentException("JWT_SECRET must be at least 32 bytes");
        }
        SecretKey key = new SecretKeySpec(keyBytes, "HmacSHA256");
        this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(key));
        NimbusJwtDecoder jwtDecoder = NimbusJwtDecoder.withSecretKey(key)
            .macAlgorithm(MacAlgorithm.HS256)
            .build();
        jwtDecoder.setJwtValidator(JwtValidators.createDefault());
        this.decoder = jwtDecoder;
    }

    public String issue(CurrentPrincipal principal) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
            .issuedAt(now)
            .expiresAt(now.plus(TOKEN_TTL))
            .subject(Long.toString(principal.id()))
            .claim("actorType", principal.actorType().name())
            .claim("role", principal.role())
            .claim("sessionId", principal.sessionId())
            .claim("clientType", principal.clientType().name())
            .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    public CurrentPrincipal parse(String token) {
        Jwt jwt = decoder.decode(token);
        return new CurrentPrincipal(
            Long.parseLong(jwt.getSubject()),
            ActorType.valueOf(jwt.getClaimAsString("actorType")),
            jwt.getClaimAsString("role"),
            jwt.getClaimAsString("sessionId"),
            ClientType.valueOf(jwt.getClaimAsString("clientType"))
        );
    }
}
