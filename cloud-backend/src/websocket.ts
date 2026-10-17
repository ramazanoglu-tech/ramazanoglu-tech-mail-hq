// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - REAL-TIME WEBSOCKET BROADCASTER (PER-USER SCOPED)
// Every socket belongs to an authenticated account and only receives events for the mail
// identities that account may access.
// =============================================================================

import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { AuthUser, authenticateCredentials, canAccessAlias } from './auth.js';
import { WebSocketMessage } from './types.js';

let wss: WebSocketServer | null = null;
const activeClients = new Map<WebSocket, AuthUser>();

export function initWebSocketServer(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });

  wss.on('connection', async (ws: WebSocket, req) => {
    const clientIp = req.socket.remoteAddress || 'unknown';

    // Queue frames that arrive while the account is still being verified
    const pending: string[] = [];
    const early = (m: unknown) => pending.push(String(m));
    ws.on('message', early);

    let user: AuthUser | null = null;
    try {
      const parsedUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const queryToken = parsedUrl.searchParams.get('token') || parsedUrl.searchParams.get('key');
      const authHeader = req.headers['authorization'];
      const bearer = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : queryToken;
      const adminHeader = req.headers['x-super-admin-key'] || req.headers['x-admin-key'] || parsedUrl.searchParams.get('key');
      user = await authenticateCredentials({
        adminKey: Array.isArray(adminHeader) ? adminHeader[0] : adminHeader,
        bearer,
      });
      // A password-change-pending account may not stream mail
      if (user?.must_change_password) user = null;
    } catch (authErr) {
      console.warn(`[SECURITY] WebSocket handshake error from ${clientIp}:`, authErr);
    }

    if (!user) {
      // Never log req.url: it carries the credential in the query string
      console.warn(`[SECURITY] Unauthorized WebSocket connection rejected from ${clientIp}`);
      ws.close(1008, 'Unauthorized');
      return;
    }
    if (ws.readyState !== WebSocket.OPEN) return;

    ws.off('message', early);
    activeClients.set(ws, user);
    console.log(`[WS] ${user.email} connected from ${clientIp}. Clients: ${activeClients.size}`);

    const welcomeMsg: WebSocketMessage = {
      type: 'SYNC_STATUS',
      payload: { message: 'Connected to Mail HQ live stream', serverTime: new Date().toISOString(), user: user.email },
      timestamp: new Date().toISOString(),
    };
    ws.send(JSON.stringify(welcomeMsg));

    const handle = (message: string) => {
      try {
        const parsed = JSON.parse(message.toString());
        if (parsed.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', payload: { pong: true, time: Date.now() }, timestamp: new Date().toISOString() }));
        }
      } catch {
        // Ignore unparseable frames
      }
    };
    pending.forEach(handle);
    ws.on('message', handle);

    ws.on('close', () => {
      activeClients.delete(ws);
    });
    ws.on('error', (err) => {
      console.error('[WS] Client connection error:', err.message);
      activeClients.delete(ws);
    });
  });

  // Drop half-open connections
  const heartbeat = setInterval(() => {
    for (const ws of activeClients.keys()) {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }
  }, 30000);
  heartbeat.unref();

  return wss;
}

/**
 * Sends an event to every client allowed to see it. Events that belong to a mail identity
 * (payload.alias_target) only reach accounts with access to that identity.
 */
export function broadcastWebSocket(type: WebSocketMessage['type'], payload: unknown) {
  if (!wss) return;

  const alias = (payload as { alias_target?: unknown } | null)?.alias_target;
  const serialized = JSON.stringify({ type, payload, timestamp: new Date().toISOString() } satisfies WebSocketMessage);

  let sentCount = 0;
  for (const [client, user] of activeClients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    if (typeof alias === 'string' && !canAccessAlias(user, alias)) continue;
    client.send(serialized);
    sentCount++;
  }

  if (sentCount > 0) {
    console.log(`[WS] Broadcasted '${type}' to ${sentCount} client(s).`);
  }
}

/**
 * Call after an account changed. Pass the fresh account to update what its sockets may see,
 * or null to disconnect them (disabled user, password reset, role change).
 */
export function refreshUserSockets(userId: string, fresh: AuthUser | null) {
  for (const [client, user] of activeClients) {
    if (user.id !== userId) continue;
    if (!fresh || fresh.must_change_password) {
      client.close(1008, 'Session ended');
      activeClients.delete(client);
    } else {
      activeClients.set(client, fresh);
    }
  }
}

export function getConnectedClientCount(): number {
  return activeClients.size;
}
