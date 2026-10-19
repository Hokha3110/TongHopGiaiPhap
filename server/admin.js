import { rm } from 'node:fs/promises';
import { transaction, fail, audit } from './db.js';
import { id, hashPassword, publicUser, digest } from './security.js';
import { importSolutions, documentSelect, documentDto } from './library.js';
import { receiveFile } from './uploads.js';
import { groups } from '../src/data/catalog.js';

export async function readJson(request, max = 1024 * 1024) {
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > max) throw fail(413, 'Nội dung quá lớn.');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString());
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object');
    return value;
  } catch { throw fail(400, 'Dữ liệu không hợp lệ.'); }
}
const text = (value, max, label) => {
  if (typeof value !== 'string' || value.length > max) throw fail(400, `${label} không hợp lệ.`);
  return value.trim();
};
function assetUrl(value) {
  if (!value) return '';
  if (/^\/api\/files\/[a-f0-9]{28}(\?view=inline)?$/.test(value) || /^\/logos\/[a-zA-Z0-9._-]+$/.test(value)) return value;
  throw fail(400, 'Chọn ảnh đã tải lên thư viện hoặc logo trong /logos/.');
}
function entryData(body, entryId, previous = {}) {
  const name = text(body.name, 180, 'Tên');
  if (!name) throw fail(400, 'Vui lòng nhập tên.');
  if (!['solution', 'collection'].includes(body.kind)) throw fail(400, 'Loại danh mục không hợp lệ.');
  if (body.kind === 'solution' && !groups.some(g => g.id === body.group && g.id !== 'all')) throw fail(400, 'Lĩnh vực không hợp lệ.');
  if (!Array.isArray(body.tags) || body.tags.length > 20 || body.tags.some(t => typeof t !== 'string' || t.length > 80)) throw fail(400, 'Tối đa 20 thẻ, mỗi thẻ 80 ký tự.');
  const partners = body.partners ?? previous.partners ?? [];
  if (!Array.isArray(partners) || partners.length>30 || partners.some(p=>typeof p!=='string' || p.length>180)) throw fail(400, 'Danh sách hãng không hợp lệ.');
  const sourceUrl = text(body.sourceUrl ?? previous.sourceUrl ?? '', 1000, 'Liên kết nguồn');
  if (sourceUrl && !/^https:\/\//.test(sourceUrl)) throw fail(400, 'Liên kết nguồn phải bắt đầu bằng https://.');
  return { ...previous, id: entryId, name, kind: body.kind, group: body.group || 'data',
    desc: text(body.desc, 2000, 'Mô tả'), body: text(body.body, 200000, 'Bài viết'),
    mark: name.toUpperCase().slice(0, 24), tone: previous.tone || 'cyan', tags: body.tags,
    partners, sourceUrl, logoUrl: assetUrl(body.logoUrl), folderName: previous.folderName || '' };
}
export async function handleAdmin(db, request, url, user) {
  if (!['admin', 'editor'].includes(user.role)) throw fail(403, 'Bạn không có quyền quản trị nội dung.');
  const parts = url.pathname.slice('/api/admin/'.length).split('/');
  const [section, target, action] = parts;
  const method = request.method;
  const page = Math.max(1, Math.min(100000, Number(url.searchParams.get('page')) || 1));
  const offset = (Math.floor(page) - 1) * 50;
  if (section === 'overview' && method === 'GET') {
    const { rows } = await db.query(`SELECT
      (SELECT count(*) FROM entries WHERE deleted_at IS NULL) AS entries,
      (SELECT count(*) FROM entries WHERE deleted_at IS NULL AND published IS NULL) AS drafts,
      (SELECT count(*) FROM documents WHERE deleted_at IS NULL) AS documents,
      (SELECT count(*) FROM users WHERE active=true) AS users,
      (SELECT coalesce(sum(size),0) FROM document_versions) AS bytes`);
    return rows[0];
  }
  if (section === 'audit' && method === 'GET') {
    if (user.role !== 'admin') throw fail(403, 'Chỉ quản trị viên được xem nhật ký.');
    return { items: (await db.query('SELECT * FROM audit_log ORDER BY id DESC LIMIT 50 OFFSET $1', [offset])).rows };
  }
  if (section === 'import' && method === 'POST') return importSolutions(db, user);
  if (section === 'users') {
    if (user.role !== 'admin') throw fail(403, 'Chỉ quản trị viên được quản lý tài khoản.');
    if (method === 'GET') return { items: (await db.query('SELECT * FROM users ORDER BY username LIMIT 50 OFFSET $1', [offset])).rows.map(publicUser) };
    if (method === 'POST' && action === 'unlock') return transaction(db, async client => {
      const existing = (await client.query('SELECT id,username,active FROM users WHERE id=$1 FOR UPDATE', [target])).rows[0];
      if (!existing) throw fail(404, 'Không tìm thấy tài khoản.');
      await client.query('UPDATE users SET active=true WHERE id=$1', [target]);
      await client.query('DELETE FROM login_attempts WHERE key=$1', [digest('user:' + existing.username)]);
      await audit(client, user, 'user.unlock', target);
      return { id: target };
    });
    if (!['POST', 'PATCH'].includes(method)) throw fail(405, 'Phương thức không hỗ trợ.');
    const body = await readJson(request, 8192);
    const username = text(body.username, 80, 'Tên đăng nhập').toLowerCase();
    const displayName = text(body.displayName, 180, 'Tên hiển thị');
    if (!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(username) || !displayName || !['admin','editor','member'].includes(body.role) || typeof body.active !== 'boolean') throw fail(400, 'Kiểm tra tên đăng nhập (3–80 ký tự), tên hiển thị và quyền.');
    const passwordHash = body.password ? await hashPassword(body.password) : null;
    if (method === 'POST' && !passwordHash) throw fail(400, 'Cần mật khẩu cho tài khoản mới.');
    return transaction(db, async client => {
      await client.query('SELECT pg_advisory_xact_lock(41024003)');
      const userId = method === 'POST' ? id() : target;
      if (method === 'PATCH') {
        const existing = (await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [userId])).rows[0];
        if (!existing) throw fail(404, 'Không tìm thấy tài khoản.');
        if (userId === user.id && (!body.active || body.role !== 'admin')) throw fail(400, 'Không thể tự khóa hoặc hạ quyền tài khoản đang dùng.');
        if (existing.role === 'admin' && existing.active && (!body.active || body.role !== 'admin')) {
          const admins = await client.query("SELECT id FROM users WHERE active=true AND role='admin' AND id<>$1", [userId]);
          if (!admins.rowCount) throw fail(400, 'Cần giữ ít nhất một quản trị viên hoạt động.');
        }
        await client.query('UPDATE users SET username=$1,display_name=$2,role=$3,active=$4,password_hash=coalesce($5,password_hash) WHERE id=$6', [username, displayName, body.role, body.active, passwordHash, userId]);
        if (passwordHash || !body.active || body.role !== existing.role) await client.query('DELETE FROM sessions WHERE user_id=$1', [userId]);
      } else await client.query('INSERT INTO users(id,username,display_name,password_hash,role,active) VALUES($1,$2,$3,$4,$5,$6)', [userId, username, displayName, passwordHash, body.role, body.active]);
      await audit(client, user, method === 'POST' ? 'user.create' : 'user.update', userId, { username, role: body.role, active: body.active, passwordReset: Boolean(passwordHash) });
      return { id: userId };
    });
  }
  if (section === 'entries') {
    if (method === 'GET') return { items: (await db.query('SELECT id,draft,published IS NOT NULL AS published,revision,updated_at,deleted_at FROM entries ORDER BY draft->>\'name\'')).rows };
    const body = await readJson(request);
    return transaction(db, async client => {
      const entryId = target || id();
      const existing = (await client.query('SELECT * FROM entries WHERE id=$1 FOR UPDATE', [entryId])).rows[0];
      if (target && !existing) throw fail(404, 'Không tìm thấy giải pháp.');
      if (existing && body.revision !== existing.revision) throw fail(409, 'Nội dung đã được người khác sửa. Tải lại trước khi lưu.');
      if (action) {
        if (method !== 'POST' || !['trash','restore','unpublish'].includes(action)) throw fail(405, 'Thao tác không hỗ trợ.');
        const sql = action === 'trash' ? 'deleted_at=now()' : action === 'restore' ? 'deleted_at=NULL' : 'published=NULL';
        await client.query(`UPDATE entries SET ${sql}, revision=revision+1,updated_at=now() WHERE id=$1`, [entryId]);
      } else {
        if (!['POST','PUT'].includes(method)) throw fail(405, 'Thao tác không hỗ trợ.');
        if (existing?.deleted_at) throw fail(409, 'Khôi phục mục này trước khi sửa.');
        const data = entryData(body, entryId, existing?.draft);
        if (existing) await client.query('UPDATE entries SET draft=$1,published=CASE WHEN $2 THEN $1::jsonb ELSE published END,revision=revision+1,updated_at=now() WHERE id=$3', [JSON.stringify(data), body.publish === true, entryId]);
        else await client.query('INSERT INTO entries(id,draft,published) VALUES($1,$2,$3)', [entryId, JSON.stringify(data), body.publish === true ? JSON.stringify(data) : null]);
      }
      await audit(client, user, `entry.${action || (body.publish === true ? 'publish' : 'save-draft')}`, entryId);
      return { id: entryId };
    });
  }
  if (section === 'documents') {
    if (method === 'GET' && action === 'versions') return { items: (await db.query('SELECT id,original_name,extension,size,created_at FROM document_versions WHERE document_id=$1 ORDER BY created_at DESC', [target])).rows };
    if (method === 'GET') {
      const entryId = url.searchParams.get('entryId') || '';
      const q = (url.searchParams.get('q') || '').slice(0, 200);
      const trash = url.searchParams.get('trash') === 'true';
      const { rows } = await db.query(`${documentSelect} WHERE ($1='' OR d.entry_id=$1) AND d.name ILIKE $2 AND (d.deleted_at IS NOT NULL)=$3 ORDER BY d.updated_at DESC LIMIT 50 OFFSET $4`, [entryId, '%' + q + '%', trash, offset]);
      return { items: rows.map(documentDto) };
    }
    if (method === 'POST' && (!target || action === 'upload')) {
      const entryId = url.searchParams.get('entryId');
      if (!target && !(await db.query('SELECT id FROM entries WHERE id=$1 AND deleted_at IS NULL', [entryId])).rowCount) throw fail(400, 'Chọn giải pháp hoặc thư viện đang hoạt động.');
      if (target && !(await db.query('SELECT id FROM documents WHERE id=$1 AND deleted_at IS NULL', [target])).rowCount) throw fail(404, 'Không tìm thấy tài liệu.');
      const uploaded = await receiveFile(request);
      try {
        return await transaction(db, async client => {
          const documentId = target || id(); const version = id();
          if (target) {
            const old = (await client.query('SELECT * FROM documents WHERE id=$1 FOR UPDATE', [target])).rows[0];
            if (old.deleted_at) throw fail(409, 'Tài liệu đã được đưa vào thùng rác.');
          } else await client.query('INSERT INTO documents(id,entry_id,name) VALUES($1,$2,$3)', [documentId, entryId, uploaded.name]);
          await client.query('INSERT INTO document_versions(id,document_id,root_kind,relative_path,original_name,extension,size) VALUES($1,$2,\'uploads\',$3,$4,$5,$6)', [version, documentId, uploaded.relative, uploaded.name, uploaded.extension, uploaded.size]);
          await client.query('UPDATE documents SET current_version=$1,updated_at=now() WHERE id=$2', [version, documentId]);
          await audit(client, user, target ? 'document.replace' : 'document.upload', documentId, { name: uploaded.name, size: uploaded.size });
          return { id: documentId, url: `/api/files/${documentId}?view=inline` };
        });
      } catch (error) { await rm(uploaded.filePath, { force: true }); throw error; }
    }
    const body = await readJson(request);
    return transaction(db, async client => {
      const old = (await client.query('SELECT * FROM documents WHERE id=$1 FOR UPDATE', [target])).rows[0];
      if (!old) throw fail(404, 'Không tìm thấy tài liệu.');
      if (method === 'PATCH' && !action) {
        const name = text(body.name, 240, 'Tên tài liệu');
        if (!name || !(await client.query('SELECT id FROM entries WHERE id=$1 AND deleted_at IS NULL', [body.entryId])).rowCount) throw fail(400, 'Tên hoặc danh mục không hợp lệ.');
        await client.query('UPDATE documents SET name=$1,entry_id=$2,updated_at=now() WHERE id=$3', [name, body.entryId, target]);
      } else if (method === 'POST' && ['trash','restore'].includes(action)) {
        await client.query(`UPDATE documents SET deleted_at=${action === 'trash' ? 'now()' : 'NULL'},updated_at=now() WHERE id=$1`, [target]);
      } else if (method === 'POST' && action === 'version') {
        if (!(await client.query('SELECT id FROM document_versions WHERE id=$1 AND document_id=$2', [body.version, target])).rowCount) throw fail(400, 'Phiên bản không hợp lệ.');
        await client.query('UPDATE documents SET current_version=$1,updated_at=now() WHERE id=$2', [body.version, target]);
      } else throw fail(405, 'Thao tác không hỗ trợ.');
      await audit(client, user, `document.${action || 'update'}`, target);
      return { id: target };
    });
  }
  throw fail(404, 'Không tìm thấy chức năng.');
}
