package com.luneng.smartstore.auth;

public record CurrentPrincipal(
    long id,
    ActorType actorType,
    String role,
    String sessionId,
    ClientType clientType
) {
    public CurrentPrincipal(long id, ActorType actorType, String role, String sessionId) {
        this(id, actorType, role, sessionId,
            actorType == ActorType.CUSTOMER ? ClientType.CUSTOMER_MINI : ClientType.ADMIN_WEB);
    }
}
