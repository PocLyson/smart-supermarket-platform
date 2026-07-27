package com.luneng.smartstore.common;

import static org.assertj.core.api.Assertions.assertThat;

import com.luneng.smartstore.support.IntegrationTestBase;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class DatabaseMigrationTest extends IntegrationTestBase {
    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void flywayCreatesEveryMvpTable() {
        List<String> names = jdbcTemplate.queryForList(
            "select table_name from information_schema.tables where table_schema = database()",
            String.class
        );

        assertThat(names).contains(
            "customer_user", "staff_account", "category", "product",
            "online_inventory", "inventory_ledger", "customer_order",
            "order_item", "order_status_history", "operation_log",
            "idempotency_record"
        );
    }
}
