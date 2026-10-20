#!/usr/bin/env bash
# One-time (idempotent) server hardening and automation. Run on the server as the normal user
# (needs sudo):   bash scripts/bootstrap-server.sh
# Does: automatic security updates (+ night reboot when required), 1 GB swap, cron jobs for
# backups / health checks / image cleanup.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib.sh
. "$here/lib.sh"

log "Automatic security updates"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq unattended-upgrades >/dev/null
sudo tee /etc/apt/apt.conf.d/20auto-upgrades >/dev/null <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
CONF
sudo tee /etc/apt/apt.conf.d/52mailhq-unattended >/dev/null <<'CONF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
CONF

if [ "$(swapon --show --noheadings | wc -l)" -eq 0 ]; then
  log "Creating 1 GB swap file"
  sudo fallocate -l 1G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
else
  log "Swap already present"
fi

log "Cron jobs"
mkdir -p "$HOME/mailhq-backups"
tmp="$(mktemp)"
crontab -l 2>/dev/null | grep -v '# mailhq-managed' > "$tmp" || true
cat >> "$tmp" <<CRON
30 3 * * * cd $REPO_DIR && bash scripts/backup-db.sh >> $HOME/mailhq-backups/backup.log 2>&1 # mailhq-managed
*/10 * * * * cd $REPO_DIR && bash scripts/healthcheck.sh >> $HOME/mailhq-backups/health.log 2>&1 # mailhq-managed
0 5 * * 0 docker image prune -f --filter until=168h >/dev/null 2>&1 # mailhq-managed
CRON
crontab "$tmp"
rm -f "$tmp"
log "Done. Current crontab:"
crontab -l
