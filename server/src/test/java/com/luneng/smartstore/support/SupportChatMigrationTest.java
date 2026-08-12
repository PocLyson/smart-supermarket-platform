package com.luneng.smartstore.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.DriverManager;
import java.sql.SQLException;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers
class SupportChatMigrationTest {
    @Container
    private static final MySQLContainer<?> MYSQL =
        new MySQLContainer<>(DockerImageName.parse("mysql:8.4"));

    @Test
    void migrationCreatesConversationsMessagesAndTheirSafetyConstraints()
        throws Exception {
        migrateToVersionEight();
        insertCustomerStaffAndOrder();

        Flyway.configure()
            .dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())
            .load()
            .migrate();

        assertThat(tableCount("customer_support_conversation")).isEqualTo(1);
        assertThat(tableCount("customer_support_message")).isEqualTo(1);

        long conversationId = insertConversation();
        assertThat(readUnreadCounts(conversationId)).containsExactly(0, 0);
        insertMessage(conversationId, "CUSTOMER", 1, "message-1", "请问什么时候可以取货？");

        assertThatThrownBy(() ->
            insertMessage(conversationId, "CUSTOMER", 1, "message-1", "重复消息")
        ).isInstanceOf(SQLException.class);
        assertThatThrownBy(() ->
            insertMessage(conversationId, "CUSTOMER", 1, "message-2", " ")
        ).isInstanceOf(SQLException.class);
        assertThatThrownBy(() ->
            insertMessage(conversationId, "CUSTOMER", 1, "message-3", "长".repeat(501))
        ).isInstanceOf(SQLException.class);
        assertThatThrownBy(this::insertConversationWithMissingOrder)
            .isInstanceOf(SQLException.class);
    }

    private void migrateToVersionEight() {
        Flyway.configure()
            .dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())
            .target("8")
            .load()
            .migrate();
    }

    private void insertCustomerStaffAndOrder() throws SQLException {
        try (var connection = DriverManager.getConnection(
            MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()
        ); var statement = connection.createStatement()) {
            statement.executeUpdate(
                "insert into customer_user(id, openid, enabled) values (1, 'support-customer', true)"
            );
            statement.executeUpdate("""
                insert into staff_account(id, username, password_hash, role, enabled)
                values (1, 'support-staff', 'hash', 'CASHIER', true)
                """);
            statement.executeUpdate("""
                insert into customer_order(
                    id, order_no, customer_id, idempotency_key, pickup_code,
                    pickup_name, phone, total_cent, status, payment_status
                ) values (
                    1, 'SUPPORT-ORDER-1', 1, 'support-order-1', '654321',
                    '顾客', '13800138000', 100, 'PENDING_CONFIRMATION', 'UNPAID'
                )
                """);
        }
    }

    private long insertConversation() throws SQLException {
        try (var connection = DriverManager.getConnection(
            MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()
        ); var statement = connection.prepareStatement("""
            insert into customer_support_conversation(customer_id, last_related_order_id)
            values (1, 1)
            """, java.sql.Statement.RETURN_GENERATED_KEYS)) {
            statement.executeUpdate();
            try (var keys = statement.getGeneratedKeys()) {
                keys.next();
                return keys.getLong(1);
            }
        }
    }

    private void insertConversationWithMissingOrder() throws SQLException {
        try (var connection = DriverManager.getConnection(
            MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()
        ); var statement = connection.createStatement()) {
            statement.executeUpdate("""
                insert into customer_support_conversation(customer_id, last_related_order_id)
                values (1, 999999)
                """);
        }
    }

    private void insertMessage(
        long conversationId,
        String senderType,
        long senderId,
        String clientMessageId,
        String content
    ) throws SQLException {
        try (var connection = DriverManager.getConnection(
            MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()
        ); var statement = connection.prepareStatement("""
            insert into customer_support_message(
                conversation_id, sender_type, sender_id, related_order_id,
                client_message_id, content
            ) values (?, ?, ?, 1, ?, ?)
            """)) {
            statement.setLong(1, conversationId);
            statement.setString(2, senderType);
            statement.setLong(3, senderId);
            statement.setString(4, clientMessageId);
            statement.setString(5, content);
            statement.executeUpdate();
        }
    }

    private int[] readUnreadCounts(long conversationId) throws SQLException {
        try (var connection = DriverManager.getConnection(
            MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()
        ); var statement = connection.prepareStatement("""
            select customer_unread_count, merchant_unread_count
            from customer_support_conversation where id = ?
            """)) {
            statement.setLong(1, conversationId);
            try (var rows = statement.executeQuery()) {
                rows.next();
                return new int[] {rows.getInt(1), rows.getInt(2)};
            }
        }
    }

    private int tableCount(String tableName) throws SQLException {
        try (var connection = DriverManager.getConnection(
            MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()
        ); var statement = connection.prepareStatement("""
            select count(*) from information_schema.tables
            where table_schema = database() and table_name = ?
            """)) {
            statement.setString(1, tableName);
            try (var rows = statement.executeQuery()) {
                rows.next();
                return rows.getInt(1);
            }
        }
    }
}
