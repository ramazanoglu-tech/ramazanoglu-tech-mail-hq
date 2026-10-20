#!/usr/bin/env bash
# Prints a health summary and exits non-zero when something needs attention.
# Optional dead-man switch: set KUMA_PUSH_URL in .env (Uptime Kuma "Push" monitor);
# it is pinged only when every check passes, so a silent server raises an alert.
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib.sh
. "$here/lib.sh"
cd "$REPO_DIR" || exit 1
if [ -f .env ]; then
  # shellcheck source=/dev/null
  set -a; . ./.env; set +a
fi

fail=0
check() { # check <label> <ok:0/1> <detail>
  if [ "$2" -eq 0 ]; then printf 'OK    %-18s %s\n' "$1" "$3"; else printf 'FAIL  %-18s %s\n' "$1" "$3"; fail=1; fi
}

if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then check backend 0 "health endpoint answers"; else check backend 1 "health endpoint down"; fi

for c in ramazanoglu_cloud_backend ramazanoglu_postgres ramazanoglu_tunnel; do
  st="$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo missing)"
  if [ "$st" = "running" ]; then check "$c" 0 "$st"; else check "$c" 1 "$st"; fi
done

used="$(df --output=pcent / | tail -1 | tr -dc '0-9')"
if [ "${used:-100}" -lt 85 ]; then check disk 0 "${used}% used"; else check disk 1 "${used}% used (limit 85%)"; fi

avail_mb="$(free -m | awk '/^Mem:/ {print $7}')"
if [ "${avail_mb:-0}" -gt 100 ]; then check memory 0 "${avail_mb} MB available"; else check memory 1 "${avail_mb} MB available (limit 100)"; fi

newest="$(find "${BACKUP_DIR:-$HOME/mailhq-backups}" -maxdepth 1 -name 'mailhq-*.sql.gz' -printf '%T@\n' 2>/dev/null | sort -nr | head -1)"
if [ -n "$newest" ]; then
  age_h=$(( ($(date +%s) - ${newest%.*}) / 3600 ))
  if [ "$age_h" -lt 36 ]; then check backup 0 "newest is ${age_h} h old"; else check backup 1 "newest is ${age_h} h old (limit 36)"; fi
else
  check backup 1 "no backup found"
fi

if [ "$fail" -eq 0 ] && [ -n "${KUMA_PUSH_URL:-}" ]; then
  curl -fsS --max-time 10 "${KUMA_PUSH_URL}?status=up&msg=OK" >/dev/null 2>&1 || true
fi
exit "$fail"
