const CircuitBreaker = require('opossum');
const { withTransaction } = require('../db');
const config = require('../config');

async function deliver(event) {
  if (config.outboxForceFail) {
    throw new Error('OUTBOX_FORCE_FAIL aktif');
  }
  if (!config.outboxTargetUrl) {
    return { delivered: true, target: 'noop' };
  }
  const response = await fetch(config.outboxTargetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Event-Type': event.event_type,
    },
    body: JSON.stringify({ id: event.id, type: event.event_type, aggregate: event.aggregate_type, aggregate_id: event.aggregate_id, payload: event.payload }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Target HTTP ${response.status}`);
  return { delivered: true, target: config.outboxTargetUrl };
}

const breaker = new CircuitBreaker(deliver, {
  timeout: 6000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  volumeThreshold: 3,
});

async function processOutboxOnce() {
  const result = await withTransaction(async (client) => {
    const rows = await client.query(
      `SELECT id, event_type, aggregate_type, aggregate_id, payload, attempts
       FROM integration.outbox
       WHERE status IN ('PENDING', 'FAILED')
         AND (next_retry_at IS NULL OR next_retry_at <= now())
       ORDER BY created_at
       LIMIT 20
       FOR UPDATE SKIP LOCKED`
    );
    let sent = 0;
    let failed = 0;
    for (const event of rows.rows) {
      try {
        await breaker.fire(event);
        await client.query(
          `UPDATE integration.outbox SET status = 'SENT', sent_at = now(), last_error = NULL WHERE id = $1`,
          [event.id]
        );
        sent += 1;
      } catch (err) {
        const attempts = event.attempts + 1;
        const delayMinutes = Math.min(2 ** attempts, 60);
        await client.query(
          `UPDATE integration.outbox
           SET status = 'FAILED', attempts = $2, last_error = $3,
               next_retry_at = now() + ($4 || ' minutes')::interval
           WHERE id = $1`,
          [event.id, attempts, err.message, delayMinutes]
        );
        failed += 1;
      }
    }
    return { processed: rows.rowCount, sent, failed };
  });
  return result;
}

let timer = null;
function startOutboxWorker() {
  if (timer) return;
  timer = setInterval(() => {
    processOutboxOnce()
      .then((r) => {
        if (r.processed) console.log('[outbox]', JSON.stringify(r));
      })
      .catch((err) => console.error('[outbox] error', err.message));
  }, config.outboxIntervalMs);
  timer.unref();
}

function stopOutboxWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { processOutboxOnce, startOutboxWorker, stopOutboxWorker };
