import './config.js';
import pg from 'pg';
import { readFile } from 'node:fs/promises';

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
pool.on('error', error => console.error('PostgreSQL connection lost:', error.code || error.name));
export async function transaction(db, fn) {
  const client = await db.connect();
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function migrate(db = pool) {
  const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  await transaction(db, async client => {
    await client.query('SELECT pg_advisory_xact_lock(41024001)');
    await client.query(sql);
  });
}
export const fail = (statusCode, message, details = {}) => Object.assign(new Error(message), { statusCode, details });
export async function audit(db, user, action, target, details = {}) {
  await db.query('INSERT INTO audit_log(actor_id, actor_name, action, target_id, details) VALUES($1,$2,$3,$4,$5)',
    [user?.id || null, user?.displayName || 'Nhập dữ liệu', action, target, JSON.stringify(details)]);
}
