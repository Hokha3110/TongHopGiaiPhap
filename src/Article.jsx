import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
const apiBase = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
export function mediaUrl(value = '') { return value.startsWith('/api/files/') ? apiBase + value : value; }
export default function Article({ body }) {
  return <div className="managed-article"><ReactMarkdown urlTransform={url => mediaUrl(defaultUrlTransform(url))}
    components={{ a: props => <a href={props.href} target="_blank" rel="noreferrer">{props.children}</a>,
      img: props => {
        const src = props.src || '';
        if (!(src.startsWith(apiBase + '/api/files/') || src.startsWith('/logos/'))) return <span>[Ảnh cần được tải lên thư viện]</span>;
        return <img src={src} alt={props.alt || 'Ảnh giải pháp'} loading="lazy"/>;
      } }}>{body || ''}</ReactMarkdown></div>;
}
