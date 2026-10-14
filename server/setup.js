import { pool, migrate, transaction, audit } from './db.js';
import { seedEntries, importSolutions } from './library.js';
import { id, hashPassword } from './security.js';

try {
  if (!process.env.DATABASE_URL) throw new Error('Thiếu DATABASE_URL trong .env.');
  await migrate();
  await transaction(pool, async client => {
    await client.query('SELECT pg_advisory_xact_lock(41024003)');
    if (!(await client.query('SELECT id FROM users LIMIT 1')).rowCount) {
      const username = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(username)) throw new Error('Đặt ADMIN_USERNAME (3–80 ký tự) và ADMIN_PASSWORD (ít nhất 12 ký tự) để tạo admin đầu tiên.');
      const hash = await hashPassword(process.env.ADMIN_PASSWORD);
      const userId = id();
      await client.query('INSERT INTO users(id,username,display_name,password_hash,role) VALUES($1,$2,$3,$4,\'admin\')', [userId, username, 'Quản trị viên', hash]);
      await audit(client, null, 'user.bootstrap', userId);
      console.log('Đã tạo tài khoản quản trị đầu tiên.');
    }
    await seedEntries(client);
  });
  console.log('Database và danh mục đã sẵn sàng.');
  if (process.argv.includes('--import')) console.log(await importSolutions(pool));
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await pool.end(); }
