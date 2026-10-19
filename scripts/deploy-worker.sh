#!/usr/bin/env bash
# Run on YOUR computer (Node installed):  bash scripts/deploy-worker.sh
# Logs in to Cloudflare, stores the shared secret and deploys the inbound mail Worker.
set -euo pipefail
cd "$(dirname "$0")/../email-worker"
npm install --no-audit --no-fund
npx wrangler login
echo "Sunucuda setup-inbound.sh'in yazdirdigi anahtari yapistirin:"
npx wrangler secret put INBOUND_WEBHOOK_SECRET
npx wrangler deploy
