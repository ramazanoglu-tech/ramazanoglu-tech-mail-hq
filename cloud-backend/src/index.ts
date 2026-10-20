// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - CLOUD BACKEND MAIN ENTRYPOINT
// =============================================================================

import http from 'http';
import path from 'path';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { initDatabase } from './db.js';
import { bootstrapOwner } from './users.js';
import { apiRouter } from './routes.js';
import { initWebSocketServer } from './websocket.js';
import { initSmtpTransporter } from './smtpDispatcher.js';
import { inboundRouter } from './inboundRoutes.js';

const app = express();
const server = http.createServer(app);

app.disable('x-powered-by');
// Behind a reverse proxy / tunnel, trust N hops so req.ip (rate limiting) is the real client IP
app.set('trust proxy', config.trustProxy);

// Security Headers & Hardening Middleware
app.use((_req: Request, res: Response, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  // Remote images/trackers inside received e-mails are blocked by img-src; scripts only from self.
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self' ws: wss:",
      "frame-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join('; ')
  );
  if (config.nodeEnv === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// CORS: same-origin PWA needs none. Native clients send no Origin header. Others must be allow-listed.
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || config.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Super-Admin-Key', 'X-Admin-Key'],
}));
// Inbound mail door needs the raw MIME body, so it is mounted before the JSON parser.
app.use('/api/inbound', inboundRouter);
app.use(express.json({ limit: '2mb' }));

// Request logging (Swiss minimalist log format)
app.use((req: Request, res: Response, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/api/health' && req.path !== '/ws') {
      console.log(`[HTTP] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// REST API
app.use('/api', apiRouter);

// Serve mobile PWA static assets if available
const pwaPublicPath = path.resolve(process.cwd(), '../mobile-pwa/public');
const pwaDistPath = path.resolve(process.cwd(), '../mobile-pwa/dist');
app.use('/pwa', express.static(pwaDistPath));
app.use('/pwa', express.static(pwaPublicPath));
app.use('/', express.static(pwaPublicPath));

// Unknown API routes: JSON 404 instead of leaking framework error pages
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found.' });
});

// Last-resort error handler: never leak stack traces to clients
app.use((err: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
  const status = typeof (err as { status?: unknown })?.status === 'number' ? (err as { status: number }).status : 500;
  if (status >= 500) console.error('[HTTP FATAL]', err);
  res.status(status).json({ error: status >= 500 ? 'Internal server error.' : 'Bad request.' });
});

async function bootstrap() {
  console.log('================================================================');
  console.log('  RAMAZANOĞLU TECH MAIL HQ - CLOUD SUPER ADMIN ENGINE');
  console.log('  Swiss-Style Architectural Minimalism & Zero-Local Dependency');
  console.log('================================================================');

  // 1. Initialize PostgreSQL Connection Pool, account tables and the first owner
  await initDatabase();
  await bootstrapOwner();
  if (config.legacyApiKeyEnabled) {
    console.warn(
      '[SECURITY] LEGACY_API_KEY_ENABLED: requests using X-Super-Admin-Key act as an anonymous owner. ' +
        'Set LEGACY_API_KEY_ENABLED=false once every client logs in with a personal account.'
    );
  }

  // 2. Initialize Outbound SMTP
  initSmtpTransporter();

  // 3. Attach Real-time WebSocket Broadcaster
  initWebSocketServer(server);

  // 4. Start HTTP Server
  server.listen(config.port, config.host, () => {
    console.log(`[HTTP] REST API running at http://${config.host}:${config.port}/api`);
    console.log(`[WS] WebSocket stream running at ws://${config.host}:${config.port}/ws`);
    console.log(`[PWA] Mobile Web Client accessible at http://${config.host}:${config.port}/`);
    if (config.host === '0.0.0.0' && config.nodeEnv === 'production') {
      console.warn('[SECURITY] Listening on 0.0.0.0 without TLS. Put this behind HTTPS (Cloudflare Tunnel / nginx / Caddy).');
    }
  });

}

// Graceful shutdown (SIGTERM is what docker/pm2/systemd send)
function shutdown(signal: string) {
  console.log(`\n[SERVER] ${signal} received. Gracefully shutting down Ramazanoğlu Tech Mail HQ...`);
  server.close(() => {
    console.log('[SERVER] Closed all active connections.');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

bootstrap().catch((err) => {
  console.error('[FATAL] Bootstrap failure:', err);
  process.exit(1);
});
