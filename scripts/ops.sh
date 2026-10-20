#!/usr/bin/env bash
# Allow-listed server operations. This is the only entry point the remote workflow may call.
#   ops.sh status | disk | backup | deploy | security-updates
#   ops.sh logs <service> | restart <service> | staging <branch>
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib.sh
. "$here/lib.sh"
cd "$REPO_DIR"

cmd="${1:-}"
arg="${2:-}"

case "$cmd" in
  status)
    echo "== uptime =="; uptime
    echo "== version =="; git log -1 --format='%h %s (%cr)'
    echo "== containers =="; docker ps --format 'table {{.Names}}\t{{.Status}}'
    echo "== health =="; bash "$here/healthcheck.sh" || true
    ;;
  disk)
    df -h /
    docker system df
    ;;
  backup)
    bash "$here/backup-db.sh"
    ;;
  deploy)
    # exec: deploy.sh replaces this script's files, so this shell must not read on afterwards
    exec bash "$here/deploy.sh"
    ;;
  security-updates)
    apt list --upgradable 2>/dev/null | grep -i security || echo "No pending security updates."
    [ -f /var/run/reboot-required ] && echo "REBOOT REQUIRED" || echo "No reboot required."
    ;;
  logs)
    is_service "$arg" || { echo "Unknown service: $arg" >&2; exit 2; }
    docker compose logs --no-color --tail 80 "$arg"
    ;;
  restart)
    is_service "$arg" || { echo "Unknown service: $arg" >&2; exit 2; }
    docker compose restart "$arg"
    ;;
  staging)
    [[ "$arg" =~ ^[A-Za-z0-9._/-]{1,80}$ ]] || { echo "Invalid branch name" >&2; exit 2; }
    bash "$here/staging.sh" "$arg"
    ;;
  *)
    echo "Usage: ops.sh status|disk|backup|deploy|security-updates|logs <svc>|restart <svc>|staging <branch>" >&2
    exit 2
    ;;
esac
