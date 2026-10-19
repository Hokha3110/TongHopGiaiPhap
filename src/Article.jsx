import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import { API_BASE as apiBase, mediaUrl } from './lib/libraryApi.js';
export { mediaUrl } from './lib/libraryApi.js';
import './article.css';
export default function Article({ body }) {
  return <div className="managed-article"><ReactMarkdown urlTransform={url => mediaUrl(defaultUrlTransform(url))}
    components={{ p: props => props.node?.children?.some(child => child.tagName === 'img') ? <div className="managed-media-paragraph">{props.children}</div> : <p>{props.children}</p>,
      a: props => <a href={props.href} target="_blank" rel="noreferrer">{props.children}</a>,
      img: props => {
        const src = props.src || '';
        if (!(src.startsWith(apiBase + '/api/files/') || src.startsWith('/logos/'))) return <span>[Ảnh cần được tải lên thư viện]</span>;
        const alt = props.alt || 'Ảnh giải pháp';
        return <figure className="managed-figure"><img src={src} alt={alt} loading="lazy"/><figcaption>{alt}</figcaption></figure>;
      },
      blockquote: props => <blockquote className="managed-callout">{props.children}</blockquote>,
      table: props => <div className="managed-table-wrap"><table>{props.children}</table></div>,
      th: props => <th scope="col">{props.children}</th>
    }}>{body || ''}</ReactMarkdown></div>;
}
