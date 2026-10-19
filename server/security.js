import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash, createHmac } from 'node:crypto';
import { promisify } from 'node:util';
import { fail } from './db.js';
const scrypt = promisify(scryptCallback);
export const id = () => randomBytes(14).toString('hex');
export const digest = value => createHash('sha256').update(value).digest('hex');
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) throw fail(400, 'Mật khẩu cần từ 12 đến 256 ký tự.');
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${key.toString('hex')}`;
}
export async function checkPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 256) return false;
  const [, salt, hash] = stored.split('$');
  const key = await scrypt(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === key.length && timingSafeEqual(key, expected);
}
// A real hash also makes unknown-user login attempts perform the same expensive operation.
const dummyHash = await hashPassword(randomBytes(24).toString('hex'));
export const publicUser = row => ({ id: row.id, username: row.username, displayName: row.display_name, role: row.role, active: row.active });
export const cookieToken = request => (request.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('tg_session='))?.slice(11);
const captchaSecret = process.env.CAPTCHA_SECRET || randomBytes(32).toString('hex');
const captchaSignature = value => createHmac('sha256', captchaSecret).update(value).digest('base64url');
export function newCaptcha() {
  const a = 2 + Math.floor(Math.random() * 8); const b = 2 + Math.floor(Math.random() * 8); const expires = Date.now() + 5 * 60 * 1000;
  const payload = `${a}.${b}.${expires}`;
  return { token: `${payload}.${captchaSignature(payload)}`, question: `${a} + ${b} = ?` };
}
function validCaptcha(token, answer) {
  if (typeof token !== 'string' || typeof answer !== 'string') return false;
  const parts = token.split('.'); if (parts.length !== 4) return false;
  const [a,b,expires,signature] = parts; const payload = `${a}.${b}.${expires}`;
  if (!/^\d+$/.test(a) || !/^\d+$/.test(b) || Number(expires) < Date.now()) return false;
  const expected = captchaSignature(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  return answer.trim() === String(Number(a) + Number(b));
}
export async function sessionUser(db, request) {
  const token = cookieToken(request);
  if (!token) return null;
  const { rows } = await db.query('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true', [digest(token)]);
  return rows[0] ? publicUser(rows[0]) : null;
}
export async function login(db, username, password, ip, captchaToken, captchaAnswer) {
  const name = typeof username === 'string' ? username.trim().toLowerCase().slice(0, 80) : '';
  const keys = [digest('user:' + name), digest('ip:' + ip)];
  const existingAttempt = (await db.query('SELECT count,started_at FROM login_attempts WHERE key=$1', [keys[0]])).rows[0];
  const activeCount = existingAttempt && new Date(existingAttempt.started_at).getTime() >= Date.now() - 15 * 60 * 1000 ? Number(existingAttempt.count) : 0;
  if (activeCount >= 10) {
    if (!validCaptcha(captchaToken, captchaAnswer)) throw fail(429, 'Xác thực CAPTCHA để tiếp tục đăng nhập.', { captchaRequired: true, captcha: newCaptcha() });
    await db.query('DELETE FROM login_attempts WHERE key=$1', [keys[0]]);
  }
  // Increment before verification: concurrent attempts cannot evade the limit.
  for (let n = 0; n < keys.length; n++) {
    const { rows } = await db.query(`INSERT INTO login_attempts(key,count) VALUES($1,1)
      ON CONFLICT(key) DO UPDATE SET count=CASE WHEN login_attempts.started_at<now()-interval '15 minutes' THEN 1 ELSE login_attempts.count+1 END,
      started_at=CASE WHEN login_attempts.started_at<now()-interval '15 minutes' THEN now() ELSE login_attempts.started_at END RETURNING count`, [keys[n]]);
    if (rows[0].count > (n === 0 ? 10 : 100)) throw fail(429, 'Xác thực CAPTCHA để tiếp tục đăng nhập.', { captchaRequired: n === 0, captcha: n === 0 ? newCaptcha() : undefined });
  }
  const { rows } = await db.query('SELECT * FROM users WHERE username=$1', [name]);
  const row = rows[0];
  const valid = await checkPassword(password, row?.password_hash || dummyHash);
  if (!row?.active || !valid) throw fail(401, 'Tên đăng nhập hoặc mật khẩu chưa đúng.');
  await db.query('DELETE FROM login_attempts WHERE key=$1', [keys[0]]);
  const token = randomBytes(32).toString('base64url');
  // Recheck hash/active atomically to avoid creating a session during a password reset.
  const result = await db.query(`INSERT INTO sessions(token_hash,user_id,expires_at)
    SELECT $1,id,now()+interval '12 hours' FROM users WHERE id=$2 AND active=true AND password_hash=$3 RETURNING user_id`, [digest(token), row.id, row.password_hash]);
  if (!result.rowCount) throw fail(401, 'Tài khoản vừa thay đổi. Vui lòng đăng nhập lại.');
  return { token, user: publicUser(row) };
}
