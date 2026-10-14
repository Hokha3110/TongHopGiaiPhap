import { createReadStream } from 'node:fs';
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import './config.js';
import { pool, fail, audit } from './db.js';
import { login, sessionUser, cookieToken, digest } from './security.js';
import { handleAdmin, readJson } from './admin.js';
import { catalog, fileRecord, documentSelect, documentDto, visibleWhere } from './library.js';

const execFileAsync = promisify(execFile);
const officePreviewJobs = new Map();
const officePreviewExtensions = new Set(['doc','docm','rtf','xls','xlsm','xlsx','ppt','pptm','pptx','odt','ods','odp']);
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8787);
const allowedOrigins = new Set((process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean));
const cookieSecure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
const sameSite = ['Strict','Lax','None'].find(s => s.toLowerCase() === (process.env.COOKIE_SAME_SITE || 'Lax').toLowerCase()) || 'Lax';
const authCookie = (token, clear = false) => `tg_session=${token}; Path=/api; HttpOnly; SameSite=${sameSite}; Max-Age=${clear ? 0 : 43200}${cookieSecure ? '; Secure' : ''}`;
function originAllowed(request) {
  if (allowedOrigins.has(request.headers.origin)) return true;
  if (process.env.NODE_ENV === 'production') return false;
  try { return ['localhost','127.0.0.1'].includes(new URL(request.headers.origin).hostname); } catch { return false; }
}
const corsHeaders = request => originAllowed(request) ? {
  'Access-Control-Allow-Origin': request.headers.origin, 'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin'
} : {};
function json(request, response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...corsHeaders(request) });
  response.end(JSON.stringify(data));
}
const mimeTypes = { '.pdf':'application/pdf','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8','.csv':'text/csv; charset=utf-8','.mp4':'video/mp4','.mov':'video/quicktime','.mkv':'video/x-matroska','.webm':'video/webm','.doc':'application/msword','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.docm':'application/vnd.ms-word.document.macroEnabled.12','.xlsm':'application/vnd.ms-excel.sheet.macroEnabled.12','.pptm':'application/vnd.ms-powerpoint.presentation.macroEnabled.12','.odt':'application/vnd.oasis.opendocument.text','.ods':'application/vnd.oasis.opendocument.spreadsheet','.odp':'application/vnd.oasis.opendocument.presentation','.rtf':'application/rtf','.xls':'application/vnd.ms-excel','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.ppt':'application/vnd.ms-powerpoint','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation','.vsdx':'application/vnd.visio' };

async function officePreviewPdf(record) {
  const inputInfo = await stat(record.absolute);
  const version = String(inputInfo.size) + '-' + String(inputInfo.mtimeMs);
  const cacheDir = path.join(tmpdir(), 'tonghop-office-preview', record.doc.id, version);
  const outputPath = path.join(cacheDir, 'source.pdf');
  try {
    await stat(outputPath);
    return outputPath;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const key = record.doc.id + ':' + version;
  if (officePreviewJobs.has(key)) return officePreviewJobs.get(key);
  const conversion = (async () => {
    await mkdir(cacheDir, { recursive: true });
    const extension = path.extname(record.absolute).toLowerCase();
    const inputPath = path.join(cacheDir, 'source' + extension);
    const profilePath = path.join(cacheDir, 'profile');
    await copyFile(record.absolute, inputPath);
    await mkdir(profilePath, { recursive: true });
    const executable = process.env.LIBREOFFICE_PATH || process.env.SOFFICE_PATH || 'soffice';
    await execFileAsync(executable, [
      '-env:UserInstallation=' + pathToFileURL(profilePath).href,
      '--headless', '--nologo', '--nodefault', '--nofirststartwizard',
      '--convert-to', 'pdf', '--outdir', cacheDir, inputPath,
    ], { timeout: 120000, windowsHide: true, maxBuffer: 1024 * 1024 });
    await stat(outputPath);
    return outputPath;
  })();
  officePreviewJobs.set(key, conversion);
  try {
    return await conversion;
  } finally {
    officePreviewJobs.delete(key);
  }
}


export function createApi(db = pool) {
 const pool = db;
 const server = createServer(async (request, response) => {
 try {
  const url = new URL(request.url, 'http://localhost');
  if (request.method === 'OPTIONS') {
    response.writeHead(originAllowed(request) ? 204 : 403, corsHeaders(request)); return response.end();
  }
  if (!url.pathname.startsWith('/api/')) throw fail(404, 'Not found');
  if (!['GET','HEAD'].includes(request.method) && !originAllowed(request)) throw fail(403, 'Nguồn gửi yêu cầu không được phép.');
  if (url.pathname === '/api/health' && request.method === 'GET') {
    await pool.query('SELECT 1'); return json(request, response, 200, { status: 'ok', database: 'ok' });
  }
  const user = await sessionUser(pool, request);
  if (url.pathname === '/api/auth/session' && request.method === 'GET') return json(request, response, 200, { configured: true, authenticated: Boolean(user), user });
  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    const body = await readJson(request, 4096);
    const peer = request.socket.remoteAddress || 'unknown';
    const trustedTunnel = process.env.TRUST_CLOUDFLARE === 'true' && ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer);
    const ip = trustedTunnel ? request.headers['cf-connecting-ip'] || peer : peer;
    const result = await login(pool, body.username, body.password, ip);
    await audit(pool, result.user, 'user.login', result.user.id);
    response.setHeader('Set-Cookie', authCookie(result.token));
    return json(request, response, 200, { authenticated: true, user: result.user });
  }
  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    const token = cookieToken(request);
    if (token) await pool.query('DELETE FROM sessions WHERE token_hash=$1', [digest(token)]);
    response.setHeader('Set-Cookie', authCookie('', true));
    return json(request, response, 200, { authenticated: false });
  }
  if (!user) throw fail(401, 'Cần đăng nhập để tiếp tục.');
  if (url.pathname.startsWith('/api/admin/')) return json(request, response, 200, await handleAdmin(pool, request, url, user));
  if (request.method !== 'GET') throw fail(405, 'Method not allowed');
  if (url.pathname === '/api/catalog') return json(request, response, 200, await catalog(pool));
  if (url.pathname === '/api/documents') {
    const entryId = url.searchParams.get('entryId');
    const { rows } = await pool.query(`${documentSelect} WHERE d.entry_id=$1 AND ${visibleWhere} ORDER BY d.name`, [entryId]);
    return json(request, response, 200, { entryId, documents: rows.map(documentDto), indexedAt: new Date().toISOString() });
  }
  if (url.pathname === '/api/search') {
    const q = (url.searchParams.get('q') || '').trim().slice(0,200);
    if (q.length < 2) return json(request, response, 200, { results: [] });
    const { rows } = await pool.query(`SELECT d.*,v.extension,v.size,e.published FROM documents d JOIN document_versions v ON v.id=d.current_version JOIN entries e ON e.id=d.entry_id WHERE ${visibleWhere} AND (d.name || ' ' || d.folder || ' ' || (e.published->>'name')) ILIKE $1 ORDER BY d.name LIMIT 60`, ['%' + q + '%']);
    return json(request, response, 200, { results: rows.map(r => ({ ...documentDto(r), entryName: r.published.name, kind: r.published.kind })) });
  }
  const officePreviewMatch = url.pathname.match(/^\/api\/office-preview\/([a-f0-9]{28})$/);
  if (officePreviewMatch) {
    const record = await fileRecord(pool, officePreviewMatch[1], ['admin','editor'].includes(user.role));
    if (!record) return json(request, response, 404, { error: 'Không tìm thấy tài liệu trong thư viện.' });
    const extension = path.extname(record.absolute).slice(1).toLowerCase();
    if (!officePreviewExtensions.has(extension)) return json(request, response, 415, { error: 'Định dạng này chưa hỗ trợ xem trước.' });
    let pdfPath;
    try {
      pdfPath = await officePreviewPdf(record);
    } catch (error) {
      if (error.code === 'ENOENT') return json(request, response, 503, { error: 'Máy chủ tài liệu chưa cài LibreOffice để chuyển file Office sang PDF.' });
      console.error('Office preview failed for ' + record.doc.name + ': ' + error.message);
      return json(request, response, 422, { error: 'Không thể chuyển tài liệu này sang bản xem trước. File có thể được bảo vệ hoặc không được hỗ trợ.' });
    }
    const pdfStat = await stat(pdfPath);
    response.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="preview.pdf"',
      'Content-Length': pdfStat.size,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
      ...corsHeaders(request),
    });
    return createReadStream(pdfPath).pipe(response);
  }
  const fileMatch = url.pathname.match(/^\/api\/files\/([a-f0-9]{28})$/);
  if (fileMatch) {
    const record = await fileRecord(pool, fileMatch[1], ['admin','editor'].includes(user.role));
    if (!record) return json(request, response, 404, { error: 'Document not found in the shared index' });
    const contentType = mimeTypes[path.extname(record.absolute).toLowerCase()] || 'application/octet-stream';
    const inline = url.searchParams.get('view') === 'inline' && !['application/octet-stream','image/svg+xml'].includes(contentType);
    const range = request.headers.range;
    const size = record.doc.size;
    let start = 0;
    let end = Math.max(0, size - 1);
    let status = 200;
    const headers = {
      'Content-Type': contentType,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(record.doc.name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
      'Accept-Ranges': 'bytes',
      ...corsHeaders(request),
    };
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || size === 0) {
        response.writeHead(416, { 'Content-Range': `bytes */${size}`, ...corsHeaders(request) });
        return response.end();
      }
      if (match[1] === '') {
        const suffixLength = Number(match[2]);
        if (!suffixLength) {
          response.writeHead(416, { 'Content-Range': `bytes */${size}`, ...corsHeaders(request) });
          return response.end();
        }
        start = Math.max(0, size - suffixLength);
        end = size - 1;
      } else {
        start = Number(match[1]);
        end = match[2] ? Number(match[2]) : size - 1;
      }
      if (start > end || start >= size || end >= size) {
        response.writeHead(416, { 'Content-Range': `bytes */${size}`, ...corsHeaders(request) });
        return response.end();
      }
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    }
    headers['Content-Length'] = range ? end - start + 1 : size;
    response.writeHead(status, headers);
    return createReadStream(record.absolute, range ? { start, end } : undefined).pipe(response);
  }
  throw fail(404, 'Not found');
 } catch (error) {
  if (response.headersSent) { response.destroy(); return; }
  const status = error.statusCode || (error.code === '23505' ? 409 : error.code === 'ENOENT' ? 404 : 500);
  if (status === 500) console.error('API request failed:', error.code || error.name);
  json(request, response, status, { error: error.statusCode ? error.message : status === 409 ? 'Tên hoặc dữ liệu đã tồn tại.' : status === 404 ? 'File không còn trên máy chủ.' : 'Máy chủ chưa xử lý được yêu cầu. Vui lòng thử lại.' });
 }
});
server.requestTimeout = 10 * 60 * 1000;
return server;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
const server = createApi();
if (!process.env.DATABASE_URL) throw new Error('Thiếu DATABASE_URL. Xem DEPLOY-LINUX.md và chạy npm run db:setup.');
await pool.query('SELECT version FROM schema_migrations WHERE version=1');
server.listen(port, host, () => console.log(`Solutions API listening on http://${host}:${port}`));
server.on('error', error => { console.error('Cannot start API:', error.code); process.exitCode=1; pool.end(); });
const cleanup = setInterval(() => Promise.all([
 pool.query('DELETE FROM sessions WHERE expires_at<now()'),
 pool.query("DELETE FROM login_attempts WHERE started_at<now()-interval '1 day'")
]).catch(error => console.error('Session cleanup:', error.code)), 60000);
cleanup.unref();
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => {
 clearInterval(cleanup); server.close(() => pool.end());
});
}


