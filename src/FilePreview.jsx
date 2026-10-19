import { useEffect, useState } from 'react';
import { Download, FileText, X } from 'lucide-react';
import { apiUrl, fileUrl, inlineUrl, fileExtension, formatSize } from './lib/libraryApi.js';
import ModalFrame from './ui/ModalFrame.jsx';

function DocxPreview({ source, title, onSessionExpired }) {
  const [preview, setPreview] = useState({ status: 'loading', html: '', message: '' });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setPreview({ status: 'loading', html: '', message: '' });
    (async () => {
      try {
        const response = await fetch(source, { credentials: 'include', signal:controller.signal });
        if (response.status === 401) onSessionExpired?.();
        if (!response.ok) throw new Error('Không tải được tài liệu từ máy chủ.');
        const arrayBuffer = await response.arrayBuffer();
        if (!active) return;
        const mammothModule = await import('mammoth/mammoth.browser.js');
        if (!active) return;
        const mammoth = mammothModule.default || mammothModule;
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const html = [
          '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<title>Tài liệu</title><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; img-src data: blob:; style-src &#39;unsafe-inline&#39;; font-src data:"><style>',
          '*{box-sizing:border-box}html{background:#e8edef}body{margin:0;padding:26px 18px;color:#20282d;font:15px/1.7 Arial,Helvetica,sans-serif}.docx-page{width:min(850px,100%);min-height:100vh;margin:0 auto;padding:54px 66px;background:#fff;box-shadow:0 4px 24px #0b1a2020;overflow-wrap:anywhere}h1,h2,h3,h4{line-height:1.3;margin:1.3em 0 .55em}p{margin:.55em 0}img{max-width:100%;height:auto}table{border-collapse:collapse;max-width:100%;width:100%;margin:1em 0}td,th{border:1px solid #9aa4a8;padding:6px 9px;vertical-align:top}ul,ol{padding-left:1.6em}pre{white-space:pre-wrap;overflow-wrap:anywhere}a{color:#087d91}',
          '@media(max-width:640px){body{padding:0}.docx-page{padding:28px 20px;box-shadow:none}}',
          '</style></head><body><article class="docx-page">', result.value, '</article></body></html>'
        ].join('');
        if (active) setPreview({ status: 'ready', html, message: '' });
      } catch {
        if (active) setPreview({ status: 'error', html: '', message: 'Không tạo được bản xem trước. Bạn vẫn có thể tải file về để mở bằng Word.' });
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [source,onSessionExpired]);
  if (preview.status === 'loading') return <div className="docx-preview-state">Đang chuẩn bị bản xem trước…</div>;
  if (preview.status === 'error') return <div className="docx-preview-state">{preview.message}</div>;
  return <div className="docx-preview-wrap"><div className="docx-preview-note">Bản xem nhanh · cách trình bày có thể khác một chút so với Word</div><iframe className="docx-preview-frame" sandbox="" srcDoc={preview.html} title={'Bản xem trước ' + title}/></div>;
}

function OfficePreview({ document, onSessionExpired }) {
  const [preview, setPreview] = useState({ status: 'loading', src: '', message: '' });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    let objectUrl = '';
    setPreview({ status: 'loading', src: '', message: '' });
    fetch(apiUrl('/api/office-preview/' + encodeURIComponent(document.id)), { credentials: 'include', signal:controller.signal })
      .then(async response => {
        if (response.status === 401) onSessionExpired?.();
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Không tạo được bản xem trước.');
        }
        const blob = await response.blob();
        if (!blob.type.includes('application/pdf')) throw new Error('Máy chủ không trả về bản xem trước PDF.');
        return URL.createObjectURL(blob);
      })
      .then(src => {
        if (active) {
          objectUrl = src;
          setPreview({ status: 'ready', src, message: '' });
        } else URL.revokeObjectURL(src);
      })
      .catch(error => {
        if (active) setPreview({ status: 'error', src: '', message: error.message });
      });
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [document.id,onSessionExpired]);
  if (preview.status === 'loading') return <div className="office-preview-state">Đang chuyển tài liệu để xem…</div>;
  if (preview.status === 'error') return <div className="office-preview-state"><FileText size={28}/><p>{preview.message}</p><small>Bạn vẫn có thể tải file về để mở bằng ứng dụng phù hợp.</small></div>;
  return <iframe className="office-preview-frame" src={preview.src} title={'Bản xem trước ' + document.name}/>;
}


const videoTypes = { mp4:'video/mp4', mov:'video/quicktime', mkv:'video/x-matroska', webm:'video/webm' };
function previewType(doc) {
  const ext = fileExtension(doc);
  if (ext === 'pdf') return 'pdf';
  if (['png','jpg','jpeg','webp','svg'].includes(ext)) return 'image';
  if (Object.hasOwn(videoTypes, ext)) return 'video';
  if (['txt','md','csv'].includes(ext)) return 'text';
  if (['docx','docm'].includes(ext)) return 'docx';
  if (['doc','rtf','xls','xlsm','xlsx','ppt','pptm','pptx','odt','ods','odp'].includes(ext)) return 'office';
  return 'other';
}
export default function FilePreview({ document, onClose, onSessionExpired }) {
  const kind = previewType(document);
  const source = inlineUrl(document);
  const oversized = ['docx','office'].includes(kind) && document.size > 30 * 1024 * 1024;
  const [retry, setRetry] = useState(0);
  return <ModalFrame className="preview-modal" labelledBy="preview-title" onClose={onClose}>
    <header className="preview-header">
      <div className="preview-title-wrap"><span className="detail-kicker">{fileExtension(document).toUpperCase() || 'TÀI LIỆU'} · {document.entryName || 'THƯ VIỆN ASIC'}</span><h2 id="preview-title">{document.name}</h2><p>{document.folder || 'Thư mục gốc'} · {formatSize(document.size)}</p></div>
      <div className="preview-actions"><a className="preview-download" href={fileUrl(document.url)} download><Download size={16}/> Tải xuống</a><button className="preview-close" type="button" onClick={onClose} aria-label="Đóng xem trước"><X size={18}/></button></div>
    </header>
    <div className={'preview-body preview-' + kind}>
      {oversized ? <div className="preview-unavailable"><span className="preview-file-icon"><FileText size={28}/></span><h3>Tài liệu này khá lớn</h3><p>Tải file để mở đầy đủ trên máy. Xem trước Office hỗ trợ file đến 30 MB để tránh làm chậm trình duyệt.</p></div> : <>
        {kind === 'pdf' && <iframe src={source} title={'Xem trước ' + document.name}/>}
        {kind === 'image' && <img src={source} alt={document.name}/>}
        {kind === 'video' && <video controls playsInline preload="metadata"><source src={source} type={videoTypes[fileExtension(document)]}/></video>}
        {kind === 'text' && <iframe src={source} title={'Nội dung ' + document.name}/>}
        {kind === 'docx' && <DocxPreview key={document.id + ':' + retry} source={source} title={document.name} onSessionExpired={onSessionExpired}/>}
        {kind === 'office' && <OfficePreview key={document.id + ':' + retry} document={document} onSessionExpired={onSessionExpired}/>}
        {kind === 'other' && <div className="preview-unavailable"><span className="preview-file-icon"><FileText size={28}/></span><h3>File này chưa xem trực tiếp được</h3><p>Tải file về để mở bằng ứng dụng phù hợp trên thiết bị của bạn.</p></div>}
      </>}
    </div>
    {['office','docx'].includes(kind) && !oversized && <div className="preview-retry"><button type="button" onClick={() => setRetry(value => value + 1)}>Thử tải bản xem trước lại</button></div>}
  </ModalFrame>;
}
