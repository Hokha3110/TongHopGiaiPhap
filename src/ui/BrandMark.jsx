import { useState } from 'react';
import { entryBrandLogo } from '../data/brandAssets.js';
import { mediaUrl } from '../lib/libraryApi.js';

export { mediaUrl } from '../lib/libraryApi.js';

export default function BrandMark({ item = {}, className = '' }) {
  const [failedSrc, setFailedSrc] = useState('');
  const logo = mediaUrl(entryBrandLogo(item));
  const mark = item.mark || item.name || 'ASIC';
  const showLogo = logo && failedSrc !== logo;
  return <span className={`wordmark ${item.tone || 'cyan'} ${mark.length > 8 ? 'long' : ''} ${showLogo ? 'has-logo' : ''} brand-${item.id || 'generic'} ${className}`}>
    {showLogo ? <img src={logo} alt={`${item.name || mark} logo`} width="180" height="72" loading="lazy" decoding="async" onError={() => setFailedSrc(logo)}/> : mark}
  </span>;
}
