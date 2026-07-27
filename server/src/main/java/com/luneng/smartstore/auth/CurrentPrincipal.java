package com.luneng.smartstore.auth;

public record CurrentPrincipal(
    long id,
    ActorType actorType,
    String role,
    String sessionId
) {
}
