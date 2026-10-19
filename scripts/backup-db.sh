#!/usr/bin/env bash
# Daily Postgres backup for Mail HQ. Run on the SERVER from anywhere:  bash scripts/backup-db.sh
# - Dumps the database from the postgres container, gzips it into ~/mailhq-backups
# - Keeps the newest KEEP files (default 14)
# - Optional offsite copy: set BACKUP_RCLONE_REMOTE (e.g. "r2:mailhq-backups") after `rclone config`
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; [ -f .env ] && . ./.env; set +a

DIR="${BACKUP_DIR:-$HOME/mailhq-backups}"
KEEP="${BACKUP_KEEP:-14}"
USER_="${POSTGRES_USER:-mailhq}"
DB="${POSTGRES_DB:-ramazanoglu_mail_db}"
mkdir -p "$DIR"
FILE="$DIR/mailhq-$(date -u +%Y%m%d-%H%M%S).sql.gz"

docker compose exec -T postgres pg_dump -U "$USER_" -d "$DB" --no-owner | gzip -9 > "$FILE.tmp"
# a dump this small means something went wrong: do not rotate good backups away
if [ "$(stat -c %s "$FILE.tmp")" -lt 1000 ]; then rm -f "$FILE.tmp"; echo "Backup failed: dump too small" >&2; exit 1; fi
mv "$FILE.tmp" "$FILE"
chmod 600 "$FILE"
echo "OK $FILE ($(du -h "$FILE" | cut -f1))"

ls -1t "$DIR"/mailhq-*.sql.gz | tail -n +$((KEEP + 1)) | xargs -r rm -f

if [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
  rclone copy "$FILE" "$BACKUP_RCLONE_REMOTE" && echo "Offsite copy done -> $BACKUP_RCLONE_REMOTE"
fi
