export const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
export const apiUrl = path => `${API_BASE}${path}`;
export const fileUrl = path => /^https?:\/\//i.test(path || '') ? path : apiUrl(path || '');
export const mediaUrl = (value = '') => value.startsWith('/api/files/') ? apiUrl(value) : value;
export const fileExtension = doc => String(doc.extension || doc.name?.split('.').pop() || '').replace(/^\./, '').toLowerCase();
export const inlineUrl = doc => {
  const source = fileUrl(doc.url);
  return /[?&]view=/.test(source) ? source.replace(/([?&])view=[^&]*/, '$1view=inline') : `${source}${source.includes('?') ? '&' : '?'}view=inline`;
};
export const foldText = value => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/gi, 'd').toLocaleLowerCase('vi').trim();
export function formatSize(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}
export function scrollToSection(id) {
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start' }));
}

export async function requestJson(path, options = {}) {
  const response = await fetch(apiUrl(path), { credentials:'include', ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(response.status === 401 ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' : data.error || 'Chưa tải được dữ liệu. Vui lòng thử lại.');
    error.status = response.status;
    throw error;
  }
  return data;
}

// Private metadata is held only in memory and discarded when the account changes.
const documentCache = new Map();
const inFlight = new Map();
let sessionScope = '';
let generation = 0;
export function setLibrarySession(userId = '') {
  if (sessionScope === userId) return;
  sessionScope = userId;
  generation += 1;
  documentCache.clear();
  for (const job of inFlight.values()) job.controller.abort();
  inFlight.clear();
}
export function loadDocuments(entryId, { force = false } = {}) {
  const cached = documentCache.get(entryId);
  if (!force && cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.documents);
  if (inFlight.has(entryId)) return inFlight.get(entryId).promise;
  const controller = new AbortController();
  const version = generation;
  const job = { controller, promise:null };
  job.promise = requestJson(`/api/documents?entryId=${encodeURIComponent(entryId)}`, { signal:controller.signal })
    .then(data => {
      const documents = Array.isArray(data.documents) ? data.documents : [];
      if (version === generation) {
        if (documentCache.size >= 24) documentCache.delete(documentCache.keys().next().value);
        documentCache.set(entryId, { documents, expiresAt:Date.now() + 60000 });
      }
      return documents;
    })
    .finally(() => { if (inFlight.get(entryId) === job) inFlight.delete(entryId); });
  inFlight.set(entryId, job);
  return job.promise;
}
