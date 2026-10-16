// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - CLOUD BACKEND MAIN ENTRYPOINT
// =============================================================================

import http from 'http';
import path from 'path';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { initDatabase } from './db.js';
import { apiRouter } from './routes.js';
import { initWebSocketServer } from './websocket.js';
import { initSmtpTransporter } from './smtpDispatcher.js';
import { startImapSyncEngine } from './imapSync.js';

const app = express();
const server = http.createServer(app);

// Security Headers & Hardening Middleware
app.use((_req: Request, res: Response, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  next();
});

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow local tools, electron/Qt desktop headers, native mobile apps, and ramazanoglu.tech
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.endsWith('ramazanoglu.tech')) {
      return callback(null, true);
    }
    // Permissive for development while logging security trace
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Super-Admin-Key', 'X-Admin-Key', 'User-Agent'],
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

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

// Fallback index
app.get('/info', (req: Request, res: Response) => {
  res.json({
    brand: 'Ramazanoğlu Technologies Inc.',
    suite: 'Mail HQ Super Admin Cloud Backend',
    version: '1.0.0',
    status: 'ONLINE',
    docs: {
      health: '/api/health',
      aliases: '/api/aliases',
      emails: '/api/emails',
      stats: '/api/stats',
      websocket: '/ws',
      mobile_pwa: '/pwa',
    },
  });
});

async function bootstrap() {
  console.log('================================================================');
  console.log('  RAMAZANOĞLU TECH MAIL HQ - CLOUD SUPER ADMIN ENGINE');
  console.log('  Swiss-Style Architectural Minimalism & Zero-Local Dependency');
  console.log('================================================================');

  // 1. Initialize PostgreSQL Connection Pool
  await initDatabase();

  // 2. Initialize Outbound SMTP
  initSmtpTransporter();

  // 3. Attach Real-time WebSocket Broadcaster
  initWebSocketServer(server);

  // 4. Start HTTP Server
  server.listen(config.port, config.host, () => {
    console.log(`[HTTP] REST API running at http://${config.host}:${config.port}/api`);
    console.log(`[WS] WebSocket stream running at ws://${config.host}:${config.port}/ws`);
    console.log(`[PWA] Mobile Web Client accessible at http://${config.host}:${config.port}/`);
  });

  // 5. Start 7/24 Cloud IMAP Synchronization Listener
  await startImapSyncEngine();
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[SERVER] Gracefully shutting down Ramazanoğlu Tech Mail HQ...');
  server.close(() => {
    console.log('[SERVER] Closed all active connections.');
    process.exit(0);
  });
});

bootstrap().catch((err) => {
  console.error('[FATAL] Bootstrap failure:', err);
  process.exit(1);
});
