package com.luneng.smartstore.staff;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.luneng.smartstore.auth.ActorType;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.support.IntegrationTestBase;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;

class StaffManagementTest extends IntegrationTestBase {
    @Autowired
    private StaffManagementService service;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private final CurrentPrincipal owner =
        new CurrentPrincipal(1L, ActorType.STAFF, "OWNER", "owner-session");
    private final CurrentPrincipal cashier =
        new CurrentPrincipal(2L, ActorType.STAFF, "CASHIER", "cashier-session");

    @BeforeEach
    void clean() {
        jdbcTemplate.update("delete from operation_log");
        jdbcTemplate.update("delete from staff_account");
    }

    @Test
    void ownerCreatesCashierWithBcryptPasswordAndCanDisableIt() {
        StaffManagementService.StaffView created = service.createCashier(
            new StaffManagementService.CreateCashierRequest("cashier-a", "secure-password"),
            owner,
            "req-create"
        );

        String hash = jdbcTemplate.queryForObject(
            "select password_hash from staff_account where id = ?",
            String.class,
            created.id()
        );
        assertThat(passwordEncoder.matches("secure-password", hash)).isTrue();

        service.setEnabled(created.id(), false, owner, "req-disable");
        assertThat(service.list(owner)).singleElement().extracting(
            StaffManagementService.StaffView::enabled
        ).isEqualTo(false);
    }

    @Test
    void cashierCannotCreateAnotherCashier() {
        assertThatThrownBy(() -> service.createCashier(
            new StaffManagementService.CreateCashierRequest("cashier-b", "secure-password"),
            cashier,
            "req-forbidden"
        )).isInstanceOf(AccessDeniedException.class);
    }
}
