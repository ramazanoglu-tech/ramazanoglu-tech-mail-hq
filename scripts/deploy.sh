#!/usr/bin/env bash
# Deploy the latest main to this server, with a pre-deploy backup and automatic rollback.
#   bash scripts/deploy.sh            # deploy origin/main
#   bash scripts/deploy.sh --force    # rebuild even when nothing changed
set -euo pipefail
# A deploy replaces the scripts on disk, so run from a temporary copy (bash reads scripts lazily).
if [ -z "${DEPLOY_HERE:-}" ]; then
  DEPLOY_HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  export DEPLOY_HERE
  tmp="$(mktemp /tmp/mailhq-deploy.XXXXXX)"
  cp "${BASH_SOURCE[0]}" "$tmp"
  exec bash "$tmp" "$@"
fi
here="$DEPLOY_HERE"
# shellcheck source=scripts/lib.sh
. "$here/lib.sh"
cd "$REPO_DIR"

# One deploy at a time
exec 9>"/tmp/mailhq-deploy.lock"
flock -n 9 || { log "Another deploy is running."; exit 1; }

force=0
[ "${1:-}" = "--force" ] && force=1

prev="$(git rev-parse HEAD)"
git fetch --quiet origin main
target="$(git rev-parse origin/main)"

if [ "$prev" = "$target" ] && [ "$force" -eq 0 ]; then
  log "Already at ${prev:0:7}. Nothing to deploy."
  exit 0
fi

log "Deploying ${prev:0:7} -> ${target:0:7}"
log "Pre-deploy backup"
bash "$here/backup-db.sh" || log "WARNING: backup failed, continuing"

git merge --ff-only origin/main

build_and_start() {
  docker compose up -d --build --remove-orphans
}

if build_and_start && wait_healthy 120; then
  log "Healthy. Deployed ${target:0:7}."
  docker image prune -f --filter "until=168h" >/dev/null 2>&1 || true
  exit 0
fi

log "FAILED health check. Rolling back to ${prev:0:7}"
git reset --hard "$prev"
build_and_start || true
if wait_healthy 120; then
  log "Rollback succeeded. Running ${prev:0:7}. The new version was NOT deployed."
else
  log "ROLLBACK ALSO UNHEALTHY. Manual attention needed."
fi
exit 1
