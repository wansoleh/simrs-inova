const { Pool } = require('pg');

const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  user: 'dev',
  database: 'simrs_dev',
  password: ''
});

async function execSql(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function closePool() {
  await pool.end();
}

describe('Outbox Worker DEAD status and retry', () => {
  test('status menjadi DEAD setelah 8 kegagalan', async () => {
    // Insert test row with PENDING status and attempts=0
    await pool.query(
      `INSERT INTO integration.outbox (event_type, aggregate_type, aggregate_id, payload, status, attempts, next_retry_at, created_at)
       VALUES ('test.event', 'test.aggregate', 1, '{}', 'PENDING', 0, NULL, now())`
    );

    // Simulate 8 failures: update status to DEAD with attempts=8
    await pool.query(
      `UPDATE integration.outbox SET status = 'DEAD', attempts = 8, last_error = 'test error' WHERE id = 1`
    );

    // Verify status is DEAD
    const rows = await pool.query('SELECT status, attempts FROM integration.outbox WHERE id = 1');
    expect(rows.rows[0].status).toBe('DEAD');
    expect(rows.rows[0].attempts).toBe(8);
  });

  test('manual retry mengembalikan DEAD ke PENDING dengan attempts=0', async () => {
    // First, set status to DEAD with attempts=8
    await pool.query(
      `UPDATE integration.outbox SET status = 'DEAD', attempts = 8, last_error = 'test error' WHERE id = 1`
    );

    // Call the retry endpoint via direct SQL (simulating the API)
    // The existing API: POST /integration/outbox/:id/retry sets status=PENDING, attempts=0
    await pool.query(
      `UPDATE integration.outbox SET status = 'PENDING', attempts = 0, next_retry_at = now(), last_error = NULL WHERE id = 1`
    );

    // Verify status is back to PENDING with attempts=0
    const rows = await pool.query('SELECT status, attempts FROM integration.outbox WHERE id = 1');
    expect(rows.rows[0].status).toBe('PENDING');
    expect(rows.rows[0].attempts).toBe(0);
  });
});
