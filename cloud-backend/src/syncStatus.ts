// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - INBOUND STATUS COUNTERS
// Mail now arrives through the signed inbound webhook (see inboundRoutes.ts); this module only keeps
// the counters that /stats and the desktop client show. The old Gmail IMAP poller was removed.
// =============================================================================

import { config } from './config.js';
import { SyncStatus } from './types.js';

let received = 0;
let lastReceivedAt: string | null = null;

export function recordInbound(): void {
  received++;
  lastReceivedAt = new Date().toISOString();
}

export function getSyncStatus(): SyncStatus {
  return {
    imap_connected: false, // field kept for client compatibility
    last_sync_time: lastReceivedAt,
    sync_active: true,
    inbox_total: received,
    domain_filtered_count: received,
    connected_clients: 0,
    database_status: config.databaseUrl ? 'CONNECTED' : 'MOCK_STORE',
  };
}

export async function pollInbox(): Promise<void> {
  // Nothing to poll: delivery is push-based.
}
