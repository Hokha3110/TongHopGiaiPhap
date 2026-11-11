export const MAX_UPLOAD_BYTES = 90 * 1024 * 1024;
export const MAX_UPLOAD_FILES = 30;
// Keep in sync with server/uploads.js. Each file uses the existing upload endpoint.
export const UPLOAD_EXTENSIONS = 'pdf doc docx docm ppt pptx pptm xls xlsx xlsm odt odp ods csv txt md rtf png jpg jpeg webp gif mp4 webm mov mkv zip rar 7z vsdx'.split(' ');
export const UPLOAD_ACCEPT = UPLOAD_EXTENSIONS.map(ext => '.' + ext).join(',');
export const fileKey = file => JSON.stringify([file.name, file.size, file.lastModified]);
export const normalizedText = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
export function fileProblem(file) {
  if (!file.size) return 'File rỗng, hãy chọn lại.';
  if (file.size > MAX_UPLOAD_BYTES) return 'Vượt giới hạn 90 MB/file.';
  if (file.name.length > 240 || /[\x00-\x1f]/.test(file.name)) return 'Tên file quá dài hoặc không hợp lệ.';
  if (!UPLOAD_EXTENSIONS.includes(file.name.split('.').pop().toLowerCase()) || !file.name.includes('.')) return 'Định dạng chưa được hỗ trợ.';
  return '';
}
export function addUploadFiles(existing, incoming) {
  const rows = [...existing];
  const keys = new Set(existing.map(row => row.key));
  let duplicates = 0, overflow = 0;
  for (const file of incoming) {
    const key = fileKey(file);
    if (keys.has(key)) { duplicates++; continue; }
    if (rows.length >= MAX_UPLOAD_FILES) { overflow++; continue; }
    keys.add(key);
    const error = fileProblem(file);
    rows.push({ key, file, status: error ? 'invalid' : 'ready', progress: 0, error });
  }
  return { rows, duplicates, overflow };
}

export function uploadDocument(file, entryId, { onProgress = () => {}, xhrFactory = () => new XMLHttpRequest() } = {}) {
  const problem = fileProblem(file);
  if (problem || !entryId) return Promise.reject(Object.assign(new Error(problem || 'Chưa chọn nơi lưu.'), { status: 400 }));
  const base = (import.meta.env?.VITE_API_BASE || '').replace(/\/$/, '');
  return new Promise((resolve, reject) => {
    const xhr = xhrFactory();
    xhr.open('POST', `${base}/api/admin/documents?entryId=${encodeURIComponent(entryId)}`);
    xhr.withCredentials = true;
    xhr.timeout = 10 * 60 * 1000;
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.min(100, Math.round(event.loaded / event.total * 100)));
    };
    const uncertain = () => reject(Object.assign(new Error('Chưa xác nhận được kết quả. Kiểm tra danh sách tài liệu trước khi tải lại để tránh trùng file.'), { uncertain: true }));
    xhr.onerror = xhr.ontimeout = xhr.onabort = uncertain;
    xhr.onload = () => {
      let result;
      try { result = JSON.parse(xhr.responseText); } catch { uncertain(); return; }
      if (xhr.status >= 200 && xhr.status < 300 && result.id) { resolve(result); return; }
      if (xhr.status >= 500 || xhr.status < 200 || (xhr.status >= 200 && xhr.status < 300)) { uncertain(); return; }
      reject(Object.assign(new Error(xhr.status === 401 ? 'Phiên đăng nhập hết hạn. Đăng nhập lại trước khi tiếp tục.' : result.error || 'Tải file thất bại.'), { status: xhr.status }));
    };
    const data = new FormData();
    data.append('file', file);
    xhr.send(data);
  });
}
