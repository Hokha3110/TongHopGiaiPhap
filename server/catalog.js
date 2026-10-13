import { createHash } from 'node:crypto';
import { readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { collections, solutions } from '../src/data/catalog.js';

const DOCUMENT_EXTENSIONS = new Set(['.pdf','.doc','.docx','.docm','.ppt','.pptx','.xls','.xlsx','.csv','.rtf','.txt','.md','.mp4','.mov','.mkv','.webm','.zip','.rar','.7z','.png','.jpg','.jpeg','.webp','.svg','.vsdx']);
const EXCLUDED_ROOTS = new Set(['0. Dành cho member','Customers-Harry-LEGION5','Draft']);
const EXCLUDED_DIR = /(^|[^a-z])(customer|khách hàng|client|member|hdbank|vpbank|draft)([^a-z]|$)|^project\b|^h05_trien khai/i;
const displayPath = value => value.split(path.sep).join('/');
const fileIdFor = relativePath => createHash('sha256').update(relativePath.toLocaleLowerCase('en')).digest('hex').slice(0, 28);

export async function scanSolutions(rootPath) {
  const root = await realpath(rootPath);
  const byId = new Map();
  const allEntries = [];

  async function walkFolder(entry, folderPath, { directOnly = false } = {}) {
    const docs = [];
    let children;
    try { children = await readdir(folderPath, { withFileTypes: true }); }
    catch { return docs; }
    for (const child of children) {
      if (child.name.startsWith('.') || child.name === 'desktop.ini' || child.name.startsWith('~$')) continue;
      const absolute = path.join(folderPath, child.name);
      if (child.isSymbolicLink()) continue;
      if (child.isDirectory()) {
        if (directOnly || EXCLUDED_DIR.test(child.name)) continue;
        docs.push(...await walkFolder(entry, absolute));
        continue;
      }
      if (!child.isFile() || !DOCUMENT_EXTENSIONS.has(path.extname(child.name).toLowerCase())) continue;
      let fileInfo;
      try { fileInfo = await stat(absolute); } catch { continue; }
      const relativePath = path.relative(root, absolute);
      const relativeDirectory = path.relative(folderPath, path.dirname(absolute));
      const id = fileIdFor(relativePath);
      const doc = {
        id, name: child.name,
        folder: relativeDirectory === '' ? '' : displayPath(relativeDirectory),
        extension: path.extname(child.name).slice(1).toUpperCase(),
        size: fileInfo.size,
        modified: fileInfo.mtime.toISOString(),
        url: `/api/files/${id}`,
        entryId: entry.id,
      };
      docs.push(doc);
      byId.set(id, { absolute, relativePath, doc });
    }
    return docs;
  }

  const rootEntries = await readdir(root, { withFileTypes: true });
  const available = new Set(rootEntries.filter(item => item.isDirectory()).map(item => item.name));
  for (const entry of solutions) {
    if (!available.has(entry.folderName) || EXCLUDED_ROOTS.has(entry.folderName)) {
      allEntries.push({ ...entry, kind: 'solution', documents: [], documentCount: 0, available: false });
      continue;
    }
    const folderPath = path.join(root, entry.folderName);
    const documents = await walkFolder(entry, folderPath);
    allEntries.push({ ...entry, kind: 'solution', documents, documentCount: documents.length, available: true });
  }
  for (const entry of collections) {
    const folderPath = entry.folderName ? path.join(root, entry.folderName) : root;
    const isRootFiles = entry.id === 'root-files';
    if (entry.folderName && !available.has(entry.folderName)) {
      allEntries.push({ ...entry, kind: 'collection', documents: [], documentCount: 0, available: false });
      continue;
    }
    const documents = await walkFolder(entry, folderPath, { directOnly: isRootFiles });
    allEntries.push({ ...entry, kind: 'collection', documents, documentCount: documents.length, available: true });
  }

  return { root, entries: allEntries, documentsById: byId, indexedAt: new Date().toISOString() };
}

if (process.argv.includes('--summary')) {
  const root = process.env.SOLUTIONS_ROOT || path.resolve('Solutions');
  scanSolutions(root).then(index => {
    console.log(`Indexed at ${index.indexedAt}`);
    console.log(`Root: ${index.root}`);
    console.log(`Solution folders available: ${index.entries.filter(item => item.kind === 'solution' && item.available).length}/${solutions.length}`);
    console.log(`Shared collections available: ${index.entries.filter(item => item.kind === 'collection' && item.available).length}/${collections.length}`);
    console.log(`Documents indexed: ${index.entries.reduce((sum, item) => sum + item.documentCount, 0)}`);
    for (const item of index.entries) console.log(`${String(item.documentCount).padStart(4)}  ${item.name}${item.available ? '' : '  [folder missing]'}`);
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
