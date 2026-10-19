import { collections, solutions } from './catalog.js';

// Keep the library and admin catalogue on the same vendor artwork. The two
// external wordmarks are retained until suitable local versions are available.
export const localBrandLogos = {
  '02-picus': '/logos/picus-clean.png',
  '06-sechard': '/logos/sechard-clean.png',
  '11-penlink': '/logos/asic-8-fit.png',
  '12-parasoft': '/logos/parasoft-fit.png',
  '04-apposite': '/logos/apposite-clean.png',
  '05-crimewall-maltego': '/logos/maltego-logo.svg',
  '07-graylog': '/logos/graylog.png',
  '08-keysight': '/logos/keysight-clean.png',
  '09-exxact': '/logos/exxact-clean.png',
  '10-accuknox': '/logos/accuknox-clean.png',
  '13-cimcor': '/logos/cimcor-clean.png',
  '14-iriusrisk': '/logos/iriusrisk-clean.png',
  '03-niagara': '/logos/niagara.png',
  '15-cyber-test': '/logos/cyber-test-system-clean.png',
  '20-security-scorecard': '/logos/securityscorecard-fit.png',
  '21-nowsecure': '/logos/nowsecure-fit.png',
  '24-trend-micro': '/logos/trendmicro-clean-fit.png',
  '28-forestall': '/logos/forestall.svg',
  '29-simspace': '/logos/simspace-clean.png',
  '666-fasoo': '/logos/fasoo.png',
  '96-seclab-tyrex': '/logos/seclab-clean.png',
  '22-blancco': '/logos/blancco-clean.png',
  '23-eggplant': 'https://mms.businesswire.com/media/20200618005581/en/679425/5/eggplant-vert-primary-logo-light-background.jpg',
  '27-forcepoint': 'https://www.arrow.com/globalecs-media/iiqpl5td/forcepoint_logo_new-webp.png',
  '25-didomi': '/logos/didomi-clean.png',
  'cyberrange-keysight': '/logos/keysight-clean.png',
};

const folderBrandLogos = new Map(
  [...solutions, ...collections]
    .filter(entry => entry.folderName && localBrandLogos[entry.id])
    .map(entry => [entry.folderName.trim().toLowerCase(), localBrandLogos[entry.id]])
);

export function entryBrandLogo(entry = {}) {
  if (typeof entry.logoUrl === 'string' && entry.logoUrl.trim()) return entry.logoUrl.trim();
  for (const id of [entry.id, entry.seedId]) {
    if (Object.hasOwn(localBrandLogos, id)) return localBrandLogos[id];
  }
  const folder = typeof entry.folderName === 'string' ? entry.folderName.trim().toLowerCase() : '';
  return folderBrandLogos.get(folder) || '';
}
