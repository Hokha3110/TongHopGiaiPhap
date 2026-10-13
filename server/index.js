import { createReadStream, readFileSync } from 'node:fs';
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { scanSolutions } from './catalog.js';

const execFileAsync = promisify(execFile);
const officePreviewJobs = new Map();
const officePreviewExtensions = new Set(['doc','docm','rtf','xls','xlsm','xlsx','ppt','pptm','pptx','odt','ods','odp']);

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Read server-only settings from .env when a process manager has not injected them.
try {
  for (const line of readFileSync(path.join(projectRoot, '.env'), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    process.env[match[1]] = value;
  }
} catch {}
const solutionsRoot = process.env.SOLUTIONS_ROOT || path.join(projectRoot, 'Solutions');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8787);
const allowedOrigins = new Set((process.env.CORS_ORIGIN || '').split(',').map(value => value.trim()).filter(Boolean));
const appUsername = process.env.APP_USERNAME || 'member';
const appPassword = process.env.APP_PASSWORD || '';
const sessionSalt = randomBytes(16);
const appPasswordKey = appPassword ? scryptSync(appPassword, sessionSalt, 64) : null;
const sessions = new Map();
const loginAttempts = new Map();
const sessionLifetime = 12 * 60 * 60 * 1000;
const cookieSameSite = ['Strict', 'Lax', 'None'].find(value => value.toLowerCase() === (process.env.COOKIE_SAME_SITE || 'Lax').toLowerCase()) || 'Lax';
const cookieSecure = process.env.COOKIE_SECURE === 'true' || (process.env.COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production');
let index;

const corsHeaders = request => {
  const origin = request.headers.origin;
  return origin && allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' } : {};
};
const json = (request, response, status, data) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...corsHeaders(request) });
  response.end(JSON.stringify(data));
};
const authCookie = (token, clear = false) => `tg_session=${clear ? '' : token}; Path=/api; HttpOnly; SameSite=${cookieSameSite}; Max-Age=${clear ? 0 : Math.floor(sessionLifetime / 1000)}${cookieSecure ? '; Secure' : ''}`;
function requestSession(request) {
  const token = (request.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('tg_session='))?.slice('tg_session='.length);
  const session = token && sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  return session;
}
function originAllowed(request) {
  const origin = request.headers.origin;
  if (!origin) return process.env.NODE_ENV !== 'production';
  if (allowedOrigins.has(origin)) return true;
  if (process.env.NODE_ENV === 'production') return false;
  try { return ['localhost', '127.0.0.1'].includes(new URL(origin).hostname); } catch { return false; }
}
async function readJsonBody(request, maxBytes = 4096) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error('Request is too large.'), { statusCode: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Invalid JSON body.'), { statusCode: 400 }); }
}
async function credentialsMatch(username, password) {
  if (!appPasswordKey || typeof username !== 'string' || typeof password !== 'string' || password.length > 1024) return false;
  const candidateKey = scryptSync(password, sessionSalt, 64);
  const userA = Buffer.from(username);
  const userB = Buffer.from(appUsername);
  const sameUsername = userA.length === userB.length && timingSafeEqual(userA, userB);
  return sameUsername && timingSafeEqual(candidateKey, appPasswordKey);
}
const publicDocument = doc => ({ id: doc.id, name: doc.name, folder: doc.folder, extension: doc.extension, size: doc.size, modified: doc.modified, url: doc.url });
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

async function refreshIndex() {
  index = await scanSolutions(solutionsRoot);
  const count = index.entries.reduce((sum, item) => sum + item.documentCount, 0);
  console.log(`Indexed ${index.entries.length} sections and ${count} documents from ${index.root}`);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (request.method === 'OPTIONS') { response.writeHead(204, corsHeaders(request)); return response.end(); }
  if (!url.pathname.startsWith('/api/')) return json(request, response, 404, { error: 'Not found' });
  if (url.pathname === '/api/auth/session' && request.method === 'GET') return json(request, response, 200, { configured: Boolean(appPasswordKey), authenticated: Boolean(requestSession(request)) });
  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    if (!appPasswordKey) return json(request, response, 503, { error: 'Máy chủ chưa cấu hình mật khẩu đăng nhập.' });
    if (!originAllowed(request)) return json(request, response, 403, { error: 'Nguồn gửi yêu cầu không được phép.' });
    const ip = request.socket.remoteAddress || 'unknown';
    const attempt = loginAttempts.get(ip) || { count: 0, startedAt: Date.now() };
    if (Date.now() - attempt.startedAt > 15 * 60 * 1000) { attempt.count = 0; attempt.startedAt = Date.now(); }
    if (attempt.count >= 8) return json(request, response, 429, { error: 'Bạn thử đăng nhập nhiều lần quá. Chờ 15 phút rồi thử lại nhé.' });
    let body;
    try { body = await readJsonBody(request); }
    catch (error) { return json(request, response, error.statusCode || 400, { error: error.message }); }
    if (!await credentialsMatch(body.username, body.password)) {
      attempt.count += 1;
      loginAttempts.set(ip, attempt);
      return json(request, response, 401, { error: 'Tên đăng nhập hoặc mật khẩu chưa đúng.' });
    }
    loginAttempts.delete(ip);
    const now = Date.now();
    for (const [token, session] of sessions) if (session.expiresAt <= now) sessions.delete(token);
    const token = randomBytes(32).toString('base64url');
    sessions.set(token, { expiresAt: now + sessionLifetime });
    response.setHeader('Set-Cookie', authCookie(token));
    return json(request, response, 200, { authenticated: true });
  }
  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    if (!originAllowed(request)) return json(request, response, 403, { error: 'Nguồn gửi yêu cầu không được phép.' });
    const token = (request.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('tg_session='))?.slice('tg_session='.length);
    if (token) sessions.delete(token);
    response.setHeader('Set-Cookie', authCookie('', true));
    return json(request, response, 200, { authenticated: false });
  }
  if (request.method !== 'GET') return json(request, response, 405, { error: 'Method not allowed' });
  if (url.pathname === '/api/health') return json(request, response, 200, { status: 'ok' });
  if (!appPasswordKey) return json(request, response, 503, { error: 'Máy chủ chưa cấu hình APP_PASSWORD.' });
  if (!requestSession(request)) return json(request, response, 401, { error: 'Cần đăng nhập để tiếp tục.' });
  if (!index) return json(request, response, 503, { error: 'Document index is not ready' });

  if (url.pathname === '/api/catalog') {
    const entries = index.entries.map(({ documents, ...entry }) => entry);
    return json(request, response, 200, { entries, indexedAt: index.indexedAt, totalDocuments: index.entries.reduce((sum, item) => sum + item.documentCount, 0) });
  }
  if (url.pathname === '/api/documents') {
    const entryId = url.searchParams.get('entryId');
    const entry = index.entries.find(item => item.id === entryId);
    if (!entry) return json(request, response, 404, { error: 'Section not found' });
    return json(request, response, 200, { entryId, documents: entry.documents.map(publicDocument), indexedAt: index.indexedAt });
  }
  if (url.pathname === '/api/search') {
    const query = (url.searchParams.get('q') || '').trim().toLocaleLowerCase('vi');
    if (query.length < 2) return json(request, response, 200, { results: [] });
    const results = index.entries.flatMap(entry => entry.documents.map(doc => ({ ...publicDocument(doc), entryId: entry.id, entryName: entry.name, kind: entry.kind })))
      .filter(doc => `${doc.name} ${doc.folder} ${doc.entryName}`.toLocaleLowerCase('vi').includes(query))
      .slice(0, 60);
    return json(request, response, 200, { results, indexedAt: index.indexedAt });
  }
  const officePreviewMatch = url.pathname.match(/^\/api\/office-preview\/([a-f0-9]{28})$/);
  if (officePreviewMatch) {
    const record = index.documentsById.get(officePreviewMatch[1]);
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
    const record = index.documentsById.get(fileMatch[1]);
    if (!record) return json(request, response, 404, { error: 'Document not found in the shared index' });
    const contentType = mimeTypes[path.extname(record.absolute).toLowerCase()] || 'application/octet-stream';
    const inline = url.searchParams.get('view') === 'inline' && contentType !== 'application/octet-stream';
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
  return json(request, response, 404, { error: 'Not found' });
});

refreshIndex().catch(error => console.error(`Cannot index ${solutionsRoot}: ${error.message}`));
const refreshTimer = setInterval(() => refreshIndex().catch(error => console.error(`Re-index failed: ${error.message}`)), 5 * 60 * 1000);
refreshTimer.unref();
server.listen(port, host, () => console.log(`Solutions API listening on http://${host}:${port}`));


