# 备份、恢复与演练

以下命令在仓库根目录执行，生产环境变量文件为 `deploy/.env.production`。

## 1. 创建一致性备份

```bash
set -euo pipefail
source deploy/.env.production
BACKUP_TS="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="$PWD/backups/$BACKUP_TS"
mkdir -p "$BACKUP_DIR"
chmod 700 "$PWD/backups" "$BACKUP_DIR"

docker compose \
  -f deploy/compose.production.yaml \
  --env-file deploy/.env.production \
  exec -T mysql mysqldump \
  -uroot -p"$MYSQL_ROOT_PASSWORD" \
  --single-transaction --routines --triggers --events \
  --set-gtid-purged=OFF "$MYSQL_DATABASE" \
  > "$BACKUP_DIR/mysql.sql"

docker run --rm \
  -v smart-store-production_image-data:/source:ro \
  -v "$BACKUP_DIR:/backup" \
  alpine:3.21 \
  tar -C /source -czf /backup/images.tar.gz .

sha256sum "$BACKUP_DIR/mysql.sql" "$BACKUP_DIR/images.tar.gz" \
  > "$BACKUP_DIR/SHA256SUMS"
chmod 600 "$BACKUP_DIR"/*
echo "$BACKUP_DIR"
```

将整个备份目录加密复制到与运行主机隔离的位置。每日备份，至少保留 7 个日备份和 4 个周备份；备份成功不等于可恢复。

## 2. 恢复到隔离目标并演练

试营业前以及每次数据库结构重大变更后必须执行，不得覆盖生产库或生产图片卷。

```bash
set -euo pipefail
source deploy/.env.production
BACKUP_DIR="$PWD/backups/<UTC-backup-timestamp>"
cd "$BACKUP_DIR"
sha256sum -c SHA256SUMS
cd - >/dev/null

RESTORE_DB="${MYSQL_DATABASE}_restore_rehearsal"
docker compose \
  -f deploy/compose.production.yaml \
  --env-file deploy/.env.production \
  exec -T mysql mysql \
  -uroot -p"$MYSQL_ROOT_PASSWORD" \
  -e "DROP DATABASE IF EXISTS \`$RESTORE_DB\`;
      CREATE DATABASE \`$RESTORE_DB\`
      CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"

docker compose \
  -f deploy/compose.production.yaml \
  --env-file deploy/.env.production \
  exec -T mysql mysql \
  -uroot -p"$MYSQL_ROOT_PASSWORD" "$RESTORE_DB" \
  < "$BACKUP_DIR/mysql.sql"

docker volume rm smart-store-image-restore-rehearsal 2>/dev/null || true
docker volume create smart-store-image-restore-rehearsal
docker run --rm \
  -v smart-store-image-restore-rehearsal:/target \
  -v "$BACKUP_DIR:/backup:ro" \
  alpine:3.21 \
  tar -C /target -xzf /backup/images.tar.gz
```

对比核心表行数：

```bash
for TABLE in customer_order order_item inventory_ledger; do
  SOURCE_COUNT="$(docker compose \
    -f deploy/compose.production.yaml \
    --env-file deploy/.env.production \
    exec -T mysql mysql -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" \
    -e "SELECT COUNT(*) FROM $TABLE;")"
  RESTORE_COUNT="$(docker compose \
    -f deploy/compose.production.yaml \
    --env-file deploy/.env.production \
    exec -T mysql mysql -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$RESTORE_DB" \
    -e "SELECT COUNT(*) FROM $TABLE;")"
  test "$SOURCE_COUNT" = "$RESTORE_COUNT"
  printf '%s source=%s restored=%s\n' "$TABLE" "$SOURCE_COUNT" "$RESTORE_COUNT"
done
```

验证所有上架商品图片都存在：

```bash
docker compose \
  -f deploy/compose.production.yaml \
  --env-file deploy/.env.production \
  exec -T mysql mysql -N \
  -uroot -p"$MYSQL_ROOT_PASSWORD" "$RESTORE_DB" \
  -e "SELECT SUBSTRING_INDEX(cover_image_url,'/',-1)
      FROM product
      WHERE on_shelf=TRUE AND cover_image_url IS NOT NULL;" \
  > "$BACKUP_DIR/referenced-images.txt"

docker run --rm \
  -v smart-store-image-restore-rehearsal:/images:ro \
  -v "$BACKUP_DIR:/backup:ro" \
  alpine:3.21 \
  sh -ec 'while IFS= read -r image; do
    [ -z "$image" ] || test -r "/images/$image"
  done < /backup/referenced-images.txt'
```

记录演练日期、操作者、备份时间点、三张表的源/恢复行数和图片校验结果。演练失败必须阻止试营业。

## 3. 灾难恢复

1. 停止 Nginx 和后端，阻止新写入。
2. 保存故障现场日志与卷快照。
3. 选择最近一次校验通过的数据库和图片同时间点备份。
4. 在隔离环境完整演练后，才恢复生产目标。
5. 恢复后核对订单金额、付款状态、库存流水、图片和审计日志。
6. 重新启动后端和 Nginx，执行健康检查和一笔受控订单闭环。

不要单独恢复图片或数据库到不同时间点；这会造成商品引用与文件不一致。
