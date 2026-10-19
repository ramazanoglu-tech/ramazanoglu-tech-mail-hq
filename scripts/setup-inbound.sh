#!/usr/bin/env bash
# Run on the SERVER (EC2) inside the repo:  bash scripts/setup-inbound.sh
# Pulls the latest code, creates INBOUND_WEBHOOK_SECRET in the root .env (once) and rebuilds.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull origin main
touch .env
if ! grep -q '^INBOUND_WEBHOOK_SECRET=.\+' .env; then
  sed -i '/^INBOUND_WEBHOOK_SECRET=/d' .env
  echo "INBOUND_WEBHOOK_SECRET=$(openssl rand -hex 32)" >> .env
  echo "Yeni INBOUND_WEBHOOK_SECRET olusturuldu."
fi
docker compose --profile tunnel up -d --build
echo
echo "=== Worker'a yapistirilacak anahtar (kimseyle paylasmayin) ==="
grep '^INBOUND_WEBHOOK_SECRET=' .env | cut -d= -f2
