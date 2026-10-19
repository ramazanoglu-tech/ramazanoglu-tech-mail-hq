#!/usr/bin/env bash
# Restore a backup INTO the running database (replaces current data!):  bash scripts/restore-db.sh ~/mailhq-backups/<file>.sql.gz
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; [ -f .env ] && . ./.env; set +a
[ -f "${1:-}" ] || { echo "usage: $0 <backup.sql.gz>"; exit 1; }
read -r -p "Bu islem mevcut veriyi silip yedegi yukler. Devam? (evet yazin) " a
[ "$a" = "evet" ] || exit 1
U="${POSTGRES_USER:-mailhq}"; D="${POSTGRES_DB:-ramazanoglu_mail_db}"
docker compose exec -T postgres psql -U "$U" -d postgres -c "DROP DATABASE IF EXISTS \"$D\" WITH (FORCE);" -c "CREATE DATABASE \"$D\" OWNER \"$U\";"
gunzip -c "$1" | docker compose exec -T postgres psql -U "$U" -d "$D" -v ON_ERROR_STOP=1 >/dev/null
docker compose restart backend
echo "Geri yukleme tamam."
