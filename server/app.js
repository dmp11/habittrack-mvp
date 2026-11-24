'use strict';

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');

const config = require('./config');
const { createDatabase } = require('./db');
const { createStore } = require('./db/store');
const { createMailer } = require('./services/mailer');
const { createPushService } = require('./services/push');
const { createScheduler } = require('./services/scheduler');
const { csrfGuard } = require('./middleware/security');
const { notFoundHandler, errorHandler } = require('./middleware/errors');
const openapi = require('./openapi');
const authRoutes = require('./routes/auth');
const habitRoutes = require('./routes/habits');
const recordRoutes = require('./routes/records');
const statsRoutes = require('./routes/stats');
const { createConfigRouter, createPushRouter } = require('./routes/misc');

async function createApp(options = {}) {
  const database = options.database || createDatabase(config);
  const store = options.store || createStore(database);
  const mailer = options.mailer || createMailer();
  const push = options.push || createPushService();
  const scheduler = options.schedulerEnabled === false
    ? { start() {}, stop() {}, checkReminders: async () => {} }
    : createScheduler({ store, mailer, push });

  await store.cleanup();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy ? 1 : false);

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const allowed = config.allowedOrigins.some((item) => {
        try {
          return new URL(item).origin === new URL(origin).origin;
        } catch {
          return false;
        }
      });
      return allowed ? callback(null, true) : callback(new Error('Origin не разрешён'));
    },
    credentials: true,
  }));
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(csrfGuard);

  const context = { store, mailer, push, scheduler };
  app.use('/api/auth', authRoutes.createRouter(context));
  app.use('/api/habits', habitRoutes.createRouter(context));
  app.use('/api/records', recordRoutes.createRouter(context));
  app.use('/api/stats', statsRoutes.createRouter(context));
  app.use('/api/config', createConfigRouter(context));
  app.use('/api/push', createPushRouter(context));
  app.get('/api/openapi.json', (req, res) => res.json(openapi));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'HabitTrack API' }));
  app.use('/api', notFoundHandler);

  const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
  const indexFile = path.join(clientDist, 'index.html');
  if (fs.existsSync(indexFile)) {
    const connectOrigins = [config.apiUrl, ...config.allowedOrigins]
      .filter(Boolean)
      .map((url) => {
        try {
          return new URL(url).origin;
        } catch {
          return '';
        }
      })
      .filter(Boolean);
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      `connect-src 'self' ${connectOrigins.join(' ')}`.trim(),
    ].join('; ');
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) res.setHeader('Content-Security-Policy', csp);
      next();
    });
    app.use(express.static(clientDist, { maxAge: '1h' }));
    app.get('*', (req, res) => res.sendFile(indexFile));
  } else {
    app.get('/', (req, res) => {
      res.type('html').send('<h1>HabitTrack API</h1><p>Документация: <a href="/api/docs">/api/docs</a></p>');
    });
    app.use(notFoundHandler);
  }

  app.use(errorHandler);

  return { app, store, database, mailer, push, scheduler };
}

module.exports = { createApp };
