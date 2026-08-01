package com.luneng.smartstore.inventory;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class InventoryRepository {
    private final JdbcTemplate jdbcTemplate;

    public InventoryRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void ensure(long productId) {
        jdbcTemplate.update(
            """
            insert into online_inventory(product_id, available_quantity, version)
            values (?, 0, 0)
            on duplicate key update product_id = values(product_id)
            """,
            productId
        );
    }

    public int lockCurrent(long productId) {
        return jdbcTemplate.queryForObject(
            "select available_quantity from online_inventory where product_id = ? for update",
            Integer.class,
            productId
        );
    }

    public int current(long productId) {
        Integer value = jdbcTemplate.query(
            "select available_quantity from online_inventory where product_id = ?",
            resultSet -> resultSet.next() ? resultSet.getInt(1) : null,
            productId
        );
        return value == null ? 0 : value;
    }

    public List<InventoryRow> list() {
        return list(null, null);
    }

    public List<InventoryRow> list(Long categoryId, InventoryService.StockStatus stockStatus) {
        StringBuilder sql = new StringBuilder("""
            select p.id as product_id,
                   p.name as product_name,
                   c.id as category_id,
                   c.name as category_name,
                   coalesce(i.available_quantity, 0) as available_quantity,
                   p.unit,
                   coalesce(i.updated_at, p.updated_at) as updated_at
              from product p
              join category c on c.id = p.category_id
              left join online_inventory i on i.product_id = p.id
             where 1 = 1
            """);
        List<Object> parameters = new ArrayList<>();
        if (categoryId != null) {
            sql.append(" and p.category_id = ?");
            parameters.add(categoryId);
        }
        if (stockStatus != null) {
            switch (stockStatus) {
                case IN_STOCK -> sql.append(" and coalesce(i.available_quantity, 0) > 0");
                case LOW_STOCK ->
                    sql.append(" and coalesce(i.available_quantity, 0) between 1 and 5");
                case OUT_OF_STOCK -> sql.append(" and coalesce(i.available_quantity, 0) = 0");
            }
        }
        sql.append(" order by p.id");
        return jdbcTemplate.query(
            sql.toString(),
            (resultSet, rowNumber) -> new InventoryRow(
                resultSet.getLong("product_id"),
                resultSet.getString("product_name"),
                resultSet.getLong("category_id"),
                resultSet.getString("category_name"),
                resultSet.getInt("available_quantity"),
                resultSet.getString("unit"),
                resultSet.getObject("updated_at", LocalDateTime.class)
            ),
            parameters.toArray()
        );
    }

    public Optional<InventoryRow> item(long productId) {
        return jdbcTemplate.query(
            """
            select i.product_id,
                   p.name as product_name,
                   c.id as category_id,
                   c.name as category_name,
                   i.available_quantity,
                   p.unit,
                   i.updated_at
              from online_inventory i
              join product p on p.id = i.product_id
              join category c on c.id = p.category_id
             where i.product_id = ?
            """,
            (resultSet, rowNumber) -> new InventoryRow(
                resultSet.getLong("product_id"),
                resultSet.getString("product_name"),
                resultSet.getLong("category_id"),
                resultSet.getString("category_name"),
                resultSet.getInt("available_quantity"),
                resultSet.getString("unit"),
                resultSet.getObject("updated_at", LocalDateTime.class)
            ),
            productId
        ).stream().findFirst();
    }

    public int adjust(long productId, int delta) {
        if (delta < 0) {
            int decrement = Math.negateExact(delta);
            return jdbcTemplate.update(
                """
                update online_inventory
                   set available_quantity = available_quantity - ?,
                       version = version + 1
                 where product_id = ?
                   and available_quantity >= ?
                """,
                decrement, productId, decrement
            );
        }
        return jdbcTemplate.update(
            """
            update online_inventory
               set available_quantity = available_quantity + ?,
                   version = version + 1
             where product_id = ?
            """,
            delta, productId
        );
    }

    public void ledger(
        long productId,
        Long orderId,
        int delta,
        int before,
        int after,
        String reason,
        String actorType,
        Long actorId
    ) {
        jdbcTemplate.update(
            """
            insert into inventory_ledger(
                product_id, order_id, quantity_delta, quantity_before, quantity_after,
                reason, actor_type, actor_id
            ) values (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            productId, orderId, delta, before, after, reason, actorType, actorId
        );
    }

    public Long orderId(String orderNo) {
        return jdbcTemplate.queryForObject(
            "select id from customer_order where order_no = ?",
            Long.class,
            orderNo
        );
    }

    public List<Map<String, Object>> reservations(long orderId) {
        return jdbcTemplate.queryForList(
            """
            select product_id, -quantity_delta as quantity
              from inventory_ledger
             where order_id = ? and reason = 'ORDER_RESERVATION'
             order by product_id
            """,
            orderId
        );
    }

    public boolean markReleased(long orderId) {
        return jdbcTemplate.update(
            """
            update customer_order
               set inventory_released = true
             where id = ? and inventory_released = false
            """,
            orderId
        ) == 1;
    }

    public int sumForOrder(String orderNo) {
        Integer total = jdbcTemplate.queryForObject(
            """
            select coalesce(sum(l.quantity_delta), 0)
              from inventory_ledger l
              join customer_order o on o.id = l.order_id
             where o.order_no = ?
            """,
            Integer.class,
            orderNo
        );
        return total == null ? 0 : total;
    }

    public void deleteForProduct(long productId) {
        jdbcTemplate.update("delete from inventory_ledger where product_id = ?", productId);
        jdbcTemplate.update("delete from online_inventory where product_id = ?", productId);
    }

    public record InventoryRow(
        long productId,
        String productName,
        long categoryId,
        String categoryName,
        int availableQuantity,
        String unit,
        LocalDateTime updatedAt
    ) {
    }
}
