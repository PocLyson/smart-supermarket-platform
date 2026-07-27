package com.luneng.smartstore.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.luneng.smartstore.auth.ActorType;
import com.luneng.smartstore.auth.CurrentPrincipal;
import com.luneng.smartstore.common.api.BusinessException;
import com.luneng.smartstore.support.IntegrationTestBase;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class InventoryServiceTest extends IntegrationTestBase {
    private final CurrentPrincipal owner =
        new CurrentPrincipal(1L, ActorType.STAFF, "OWNER", "test-session");

    @Autowired
    private InventoryService inventoryService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUpProduct() {
        jdbcTemplate.update(
            "insert into category(id, name, sort_order, enabled) values (1, '乳制品', 1, true)"
        );
        jdbcTemplate.update(
            """
            insert into product(id, category_id, name, price_cent, unit, on_shelf)
            values (10, 1, '纯牛奶', 590, '盒', true)
            """
        );
    }

    @Test
    void adjustmentCreatesLedgerAndNeverAllowsNegativeStock() {
        inventoryService.adjust(10L, 10, "首批线上库存", owner);

        assertThat(inventoryService.current(10L)).isEqualTo(10);
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from inventory_ledger where product_id = 10",
            Integer.class
        )).isEqualTo(1);
        assertThatThrownBy(() -> inventoryService.adjust(10L, -11, "盘点", owner))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("库存不足");
        assertThat(inventoryService.current(10L)).isEqualTo(10);
    }
}
