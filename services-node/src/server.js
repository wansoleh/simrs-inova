const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const swaggerUi = require('swagger-ui-express');

const config = require('./config');
const { query } = require('./db');
const requestId = require('./middleware/requestId');
const { notFound, errorHandler } = require('./middleware/error');
const { startOutboxWorker, stopOutboxWorker } = require('./services/outboxWorker');
const { retryFailedInbox } = require('./services/inboxService');
const dashboardRoutes = require('./routes/dashboard');
const labRoutes = require('./routes/lab').router;
const integrationRoutes = require('./routes/integration');
const bonusRoutes = require('./routes/bonus');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(requestId);
app.use(rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.path === '/svc/v1/health',
}));

async function health(_req, res) {
  try {
    await query('SELECT 1');
    return res.json({
      success: true,
      message: 'Service Node sehat',
      data: { service: 'services-node', db: 'ok', env: config.env, uptime: process.uptime() },
      meta: null,
      errors: null,
      request_id: res.getHeader('X-Request-Id'),
    });
  } catch (err) {
    return res.status(503).json({
      success: false,
      message: 'Database tidak terjangkau',
      data: { service: 'services-node', db: 'down' },
      meta: null,
      errors: [err.message],
      request_id: res.getHeader('X-Request-Id'),
      code: 'DB_UNAVAILABLE',
    });
  }
}

app.get('/health', health);
app.get('/svc/v1/health', health);

const openapi = YAML.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'docs', 'openapi.yaml'), 'utf8')
);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'SIMRS Node API' }));
app.get('/docs.json', (_req, res) => res.json(openapi));

app.use('/svc/v1/dashboard', dashboardRoutes);
app.use('/svc/v1/lab', labRoutes);
app.use('/svc/v1/integration', integrationRoutes);
app.use('/svc/v1', bonusRoutes);

app.use(notFound);
app.use(errorHandler);

let inboxTimer = null;
const server = app.listen(config.port, '127.0.0.1', () => {
  console.log(`[server] SIMRS Node listening on http://127.0.0.1:${config.port}`);
  startOutboxWorker();
  inboxTimer = setInterval(() => {
    retryFailedInbox(10)
      .then((r) => {
        if (r.attempted) console.log('[inbox]', JSON.stringify(r));
      })
      .catch((err) => console.error('[inbox] error', err.message));
  }, 60_000);
  inboxTimer.unref();
});

function shutdown(signal) {
  console.log(`[server] ${signal} received, shutting down`);
  stopOutboxWorker();
  if (inboxTimer) clearInterval(inboxTimer);
  server.close(() => process.exit(0));
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
