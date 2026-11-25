const path = require('node:path');
const fs = require('node:fs');

function loadEnvFile() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}
loadEnvFile();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3001),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'simrs_dev',
    user: process.env.DB_USER || 'simrs_dev',
    password: process.env.DB_PASS || '',
    max: Number(process.env.DB_POOL_MAX || 20),
    idleTimeoutMillis: 30000,
  },
  jwtPublicKeyPath: process.env.JWT_PUBLIC_KEY_PATH
    || path.resolve(__dirname, '..', '..', 'backend-yii', 'keys', 'jwt_public.pem'),
  serviceToken: process.env.SERVICE_TOKEN || 'simrs-dev-service-token',
  yiiInternalUrl: process.env.YII_INTERNAL_URL || 'http://127.0.0.1:8088',
  outboxIntervalMs: Number(process.env.OUTBOX_INTERVAL_MS || 15000),
  outboxTargetUrl: process.env.OUTBOX_TARGET_URL || '',
  outboxForceFail: process.env.OUTBOX_FORCE_FAIL === '1',
};

module.exports = config;
