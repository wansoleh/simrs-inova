const { query } = require('../db');
const config = require('../config');
const AppError = require('../middleware/AppError');

async function syncInboxToYii(inboxId) {
  const result = await query(
    'SELECT id, external_ref, payload FROM integration.inbox WHERE id = $1',
    [inboxId]
  );
  if (!result.rows.length) throw AppError.notFound('Inbox tidak ditemukan');
  const inbox = result.rows[0];
  try {
    const response = await fetch(`${config.yiiInternalUrl}/internal/v1/lab-results`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Token': config.serviceToken,
        'Idempotency-Key': inbox.external_ref,
      },
      body: JSON.stringify(inbox.payload),
      signal: AbortSignal.timeout(5000),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message || `Yii HTTP ${response.status}`);
    await query(
      `UPDATE integration.inbox
       SET status = 'PROCESSED', processed_at = now(), attempts = attempts + 1, last_error = NULL
       WHERE id = $1`,
      [inbox.id]
    );
    return { inbox_id: inbox.id, synced: true, response: body };
  } catch (err) {
    await query(
      `UPDATE integration.inbox
       SET status = 'FAILED', attempts = attempts + 1, last_error = $2
       WHERE id = $1`,
      [inbox.id, err.message]
    );
    return { inbox_id: inbox.id, synced: false, error: err.message };
  }
}

async function retryFailedInbox(limit = 20) {
  const result = await query(
    `SELECT id FROM integration.inbox
     WHERE status = 'FAILED' AND attempts < 10
     ORDER BY created_at LIMIT $1`,
    [limit]
  );
  let ok = 0;
  for (const row of result.rows) {
    const sync = await syncInboxToYii(row.id);
    if (sync.synced) ok += 1;
  }
  return { attempted: result.rows.length, synced: ok };
}

module.exports = { syncInboxToYii, retryFailedInbox };
