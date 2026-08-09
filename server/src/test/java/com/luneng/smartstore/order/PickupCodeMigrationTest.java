package com.luneng.smartstore.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers
class PickupCodeMigrationTest {
    @Container
    private static final MySQLContainer<?> MYSQL =
        new MySQLContainer<>(DockerImageName.parse("mysql:8.4"));

    @Test
    void migrationBackfillsIndependentSixDigitSecretsAndEnforcesTheInvariant()
        throws Exception {
        migrateToVersionSeven();
        insertLegacyOrders();

        Flyway.configure()
            .dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())
            .load()
            .migrate();

        assertThat(pickupCodeColumnCount()).isEqualTo(1);
        List<String> pickupCodes = readPickupCodes();
        assertThat(pickupCodes)
            .hasSize(4)
            .allSatisfy(code -> assertThat(code).matches("[0-9]{6}"))
            .anySatisfy(code -> assertThat(code).isNotEqualTo("123456"));

        assertThatThrownBy(() -> insertOrderAfterMigration("INVALID-ASCII", "１２３４５６"))
            .isInstanceOf(SQLException.class);
        assertThatThrownBy(() -> insertOrderAfterMigration("INVALID-LENGTH", "12345"))
            .isInstanceOf(SQLException.class);
    }

    private void migrateToVersionSeven() {
        Flyway.configure()
            .dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())
            .target("7")
            .load()
            .migrate();
    }

    private void insertLegacyOrders() throws SQLException {
        try (var connection = DriverManager.getConnection(
            MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()
        ); var statement = connection.createStatement()) {
            statement.executeUpdate(
                "insert into customer_user(id, openid, enabled) values (1, 'legacy', true)"
            );
            for (int index = 0; index < 4; index++) {
                statement.executeUpdate("""
                    insert into customer_order(
                        order_no, customer_id, idempotency_key, pickup_name, phone,
                        total_cent, status, payment_status
                    ) values (
                        'LEGACY-%d-123456', 1, 'legacy-%d', 'Legacy', '13800138000',
                        100, 'PENDING_CONFIRMATION', 'UNPAID'
                    )
                    """.formatted(index, index));
            }
        }
    }

    private List<String> readPickupCodes() throws SQLException {
        List<String> codes = new ArrayList<>();
        try (var connection = DriverManager.getConnection(
            MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()
        ); var statement = connection.createStatement(); var rows = statement.executeQuery(
            "select pickup_code from customer_order order by id"
        )) {
            while (rows.next()) {
                codes.add(rows.getString(1));
            }
        }
        return codes;
    }

    private int pickupCodeColumnCount() throws SQLException {
        try (var connection = DriverManager.getConnection(
            MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()
        ); var statement = connection.createStatement(); var rows = statement.executeQuery("""
            select count(*) from information_schema.columns
            where table_schema = database()
              and table_name = 'customer_order'
              and column_name = 'pickup_code'
            """)) {
            rows.next();
            return rows.getInt(1);
        }
    }

    private void insertOrderAfterMigration(String suffix, String pickupCode)
        throws SQLException {
        try (var connection = DriverManager.getConnection(
            MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()
        ); var statement = connection.prepareStatement("""
            insert into customer_order(
                order_no, customer_id, idempotency_key, pickup_code, pickup_name, phone,
                total_cent, status, payment_status
            ) values (?, 1, ?, ?, 'Legacy', '13800138000', 100,
                      'PENDING_CONFIRMATION', 'UNPAID')
            """)) {
            statement.setString(1, suffix);
            statement.setString(2, suffix);
            statement.setString(3, pickupCode);
            statement.executeUpdate();
        }
    }
}
