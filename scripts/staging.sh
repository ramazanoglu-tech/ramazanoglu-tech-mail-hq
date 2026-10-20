#!/usr/bin/env bash
# Build and start a branch in the isolated staging stack (own database, port 8766, mock mail off).
#   bash scripts/staging.sh <branch-or-ref>
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib.sh
. "$here/lib.sh"
ref="${1:?usage: staging.sh <branch>}"
dir="${STAGING_DIR:-$HOME/mailhq-staging}"
origin="$(git -C "$REPO_DIR" remote get-url origin)"

[ -d "$dir/.git" ] || git clone --quiet "$origin" "$dir"
git -C "$dir" fetch --quiet origin "$ref"
git -C "$dir" checkout --quiet --detach FETCH_HEAD
log "Staging at $(git -C "$dir" log -1 --format='%h %s')"

cd "$dir"
if [ ! -f .env.staging ]; then
  # First run: generate throwaway secrets for staging only
  {
    echo "STAGING_POSTGRES_PASSWORD=$(openssl rand -hex 16)"
    echo "STAGING_SUPER_ADMIN_PASSWORD=$(openssl rand -hex 16)"
    echo "STAGING_JWT_SECRET=$(openssl rand -hex 32)"
  } > .env.staging
  chmod 600 .env.staging
fi
docker compose -p mailhq-staging --env-file .env.staging -f docker-compose.staging.yml up -d --build
HEALTH_URL="http://127.0.0.1:8766/api/health"
if wait_healthy 90; then
  log "Staging healthy on 127.0.0.1:8766"
else
  log "Staging unhealthy"
  exit 1
fi
