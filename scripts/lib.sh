#!/usr/bin/env bash
# Shared helpers for the server scripts. Source it, do not run it.
# shellcheck shell=bash

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export REPO_DIR
export COMPOSE_PROFILES="${COMPOSE_PROFILES:-tunnel,tools}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8765/api/health}"
SERVICES="backend postgres cloudflared uptime-kuma vaultwarden"

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

is_service() {
  local s
  for s in $SERVICES; do [ "$s" = "${1:-}" ] && return 0; done
  return 1
}

wait_healthy() {
  # wait_healthy <seconds>: true once the backend health endpoint answers
  local deadline=$((SECONDS + ${1:-90}))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if curl -fsS --max-time 4 "$HEALTH_URL" >/dev/null 2>&1; then return 0; fi
    sleep 3
  done
  return 1
}
