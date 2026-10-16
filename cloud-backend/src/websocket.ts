// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - REAL-TIME WEBSOCKET BROADCASTER
// =============================================================================

import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { isValidAdminKey, verifyAdminToken } from './auth.js';
import { WebSocketMessage } from './types.js';

let wss: WebSocketServer | null = null;
const activeClients = new Set<WebSocket>();

export function initWebSocketServer(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    const clientIp = req.socket.remoteAddress || 'unknown';

    // Zero-Trust Handshake Authentication Check
    try {
      const parsedUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const keyParam = parsedUrl.searchParams.get('key') || parsedUrl.searchParams.get('token');
      const authHeader = req.headers['authorization'];
      const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
      const adminHeader = req.headers['x-super-admin-key'] || req.headers['x-admin-key'];

      let authorized = false;
      if (isValidAdminKey(keyParam) || isValidAdminKey(adminHeader)) {
        authorized = true;
      } else {
        const tokenToVerify = bearerToken || keyParam;
        if (tokenToVerify && verifyAdminToken(tokenToVerify)) {
          authorized = true;
        }
      }

      if (!authorized) {
        // Never log req.url: it carries the credential in the query string
        console.warn(`[SECURITY VIOLATION] Unauthorized WebSocket connection rejected from ${clientIp}`);
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: { error: 'Unauthorized: Valid Super Admin Key or JWT token required' },
          timestamp: new Date().toISOString(),
        }));
        ws.close(1008, 'Unauthorized: Access Denied');
        return;
      }
    } catch (authErr) {
      console.warn(`[SECURITY VIOLATION] WebSocket handshake parse error from ${clientIp}:`, authErr);
      ws.close(1008, 'Handshake Error');
      return;
    }

    console.log(`[WS] Authenticated client connected from ${clientIp}. Total connected clients: ${wss?.clients.size}`);
    activeClients.add(ws);

    // Send immediate welcome handshake
    const welcomeMsg: WebSocketMessage = {
      type: 'SYNC_STATUS',
      payload: {
        message: 'Connected to Ramazanoğlu Tech Mail HQ Cloud Stream (Zero-Trust Verified)',
        serverTime: new Date().toISOString(),
        clients: wss?.clients.size,
      },
      timestamp: new Date().toISOString(),
    };
    ws.send(JSON.stringify(welcomeMsg));

    ws.on('message', (message: string) => {
      try {
        const parsed = JSON.parse(message.toString());
        if (parsed.type === 'PING') {
          ws.send(
            JSON.stringify({
              type: 'PONG',
              payload: { pong: true, time: Date.now() },
              timestamp: new Date().toISOString(),
            })
          );
        }
      } catch {
        // Ignore unparseable frames
      }
    });

    ws.on('close', () => {
      activeClients.delete(ws);
      console.log(`[WS] Client disconnected. Remaining: ${activeClients.size}`);
    });

    ws.on('error', (err) => {
      console.error('[WS] Client connection error:', err);
      activeClients.delete(ws);
    });
  });

  return wss;
}

export function broadcastWebSocket(type: WebSocketMessage['type'], payload: unknown) {
  if (!wss) return;

  const msg: WebSocketMessage = {
    type,
    payload,
    timestamp: new Date().toISOString(),
  };
  const serialized = JSON.stringify(msg);

  let sentCount = 0;
  for (const client of activeClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(serialized);
      sentCount++;
    }
  }

  if (sentCount > 0) {
    console.log(`[WS] Broadcasted '${type}' to ${sentCount} active client(s).`);
  }
}

export function getConnectedClientCount(): number {
  return activeClients.size;
}
