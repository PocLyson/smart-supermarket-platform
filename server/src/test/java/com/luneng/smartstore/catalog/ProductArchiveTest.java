package com.luneng.smartstore.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.luneng.smartstore.common.api.BusinessException;
import com.luneng.smartstore.support.IntegrationTestBase;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class ProductArchiveTest extends IntegrationTestBase {
    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void archiveAndRestoreAreIdempotentAndKeepTheProductOffShelf() {
        Product product = product(true);

        assertThat(product.archive(7L)).isTrue();
        assertThat(product.isArchived()).isTrue();
        assertThat(product.isOnShelf()).isFalse();
        assertThat(product.getArchivedAt()).isNotNull();
        assertThat(product.getArchivedBy()).isEqualTo(7L);

        assertThat(product.archive(7L)).isFalse();
        assertThat(product.restore(7L)).isTrue();
        assertThat(product.isArchived()).isFalse();
        assertThat(product.isOnShelf()).isFalse();
        assertThat(product.getArchivedAt()).isNull();
        assertThat(product.getArchivedBy()).isNull();
        assertThat(product.restore(7L)).isFalse();
    }

    @Test
    void archivedProductRejectsUpdatesAndGoingOnShelfButAllowsIdempotentOffShelf() {
        Product product = product(true);
        product.archive(7L);

        assertThatThrownBy(() -> product.update(
            new Category("新分类", 2, true), "新名称", 200, "盒", null, null, true
        ))
            .isInstanceOf(BusinessException.class)
            .extracting(exception -> ((BusinessException) exception).getCode())
            .isEqualTo("PRODUCT_ARCHIVED");
        assertThatThrownBy(() -> product.setOnShelf(true))
            .isInstanceOf(BusinessException.class)
            .extracting(exception -> ((BusinessException) exception).getCode())
            .isEqualTo("PRODUCT_ARCHIVED");

        product.setOnShelf(false);

        assertThat(product.isOnShelf()).isFalse();
    }

    @Test
    void flywayAddsProductArchiveColumns() {
        List<String> columns = jdbcTemplate.queryForList(
            "select column_name from information_schema.columns "
                + "where table_schema = database() and table_name = 'product'",
            String.class
        );

        assertThat(columns).contains("archived", "archived_at", "archived_by");
    }

    private Product product(boolean onShelf) {
        return new Product(new Category("饮料", 1, true), "矿泉水", 100, "瓶", null, null, onShelf);
    }
}
