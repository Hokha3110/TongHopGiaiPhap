import path from 'node:path';
import { realpath, stat } from 'node:fs/promises';
import { solutionsRoot, uploadsRoot } from './config.js';
import { fail, transaction, audit } from './db.js';
import { id } from './security.js';
import { scanSolutions } from './catalog.js';
import { solutions, collections } from '../src/data/catalog.js';
import { productDetails, areaDetails, sourceOnlySolutions } from '../src/data/solutionDetails.js';

export function profileMarkdown(entry) {
  const p = sourceOnlySolutions[entry.id] || productDetails[entry.id] || areaDetails[entry.group] || {};
  return [p.headline && `## ${p.headline}`, ...(p.intro || [p.summary]).filter(Boolean),
    ...(p.capabilities || []).map(c => `### ${c.title}\n\n${c.text}`),
    p.useCases?.length && `## Phạm vi áp dụng\n\n${p.useCases.map(t => '- ' + t).join('\n')}`,
    p.questions?.length && `## Gợi ý đánh giá\n\n${p.questions.map(([title, text]) => `### ${title}\n\n${text}`).join('\n\n')}`].filter(Boolean).join('\n\n');
}
export async function seedEntries(db) {
  const featured = Object.entries(sourceOnlySolutions).map(([entryId,p]) => ({ id:entryId, name:p.title, desc:p.summary, kind:'solution', group:'config', featured:true }));
  for (const entry of [...solutions.map(e => ({ ...e, kind: 'solution' })), ...collections.map(e => ({ ...e, kind: 'collection' })), ...featured]) {
    const area = sourceOnlySolutions[entry.id] || areaDetails[entry.group] || {};
    const profile = productDetails[entry.id] || null;
    const data = { tags: [], group: 'data', mark: entry.name.toUpperCase().slice(0,24), tone: 'cyan', ...entry, body: profileMarkdown(entry), profile, area, partners: profile?.partners || area.partners || [], sourceUrl:area.sourceUrl || '', logoUrl: '' };
    await db.query('INSERT INTO entries(id,draft,published) VALUES($1,$2,$2) ON CONFLICT DO NOTHING', [entry.id, JSON.stringify(data)]);
  }
}
export async function importSolutions(db, actor = null) {
  const scanned = await scanSolutions(solutionsRoot);
  return transaction(db, async client => {
    await client.query('SELECT pg_advisory_xact_lock(41024002)');
    let imported = 0;
    for (const record of scanned.documentsById.values()) {
      const d = record.doc;
      const exists = await client.query('SELECT id FROM entries WHERE id=$1', [d.entryId]);
      if (!exists.rowCount) continue;
      const added = await client.query('INSERT INTO documents(id,entry_id,name,folder) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id', [d.id, d.entryId, d.name, d.folder]);
      if (!added.rowCount) continue; // Preserve edits, replacements and trash on later imports.
      const version = id();
      await client.query('INSERT INTO document_versions(id,document_id,root_kind,relative_path,original_name,extension,size) VALUES($1,$2,$3,$4,$5,$6,$7)', [version, d.id, 'solutions', record.relativePath, d.name, d.extension.toLowerCase(), d.size]);
      await client.query('UPDATE documents SET current_version=$1 WHERE id=$2', [version, d.id]);
      imported++;
    }
    await audit(client, actor, 'documents.import', 'Solutions', { imported, scanned: scanned.documentsById.size });
    return { imported, scanned: scanned.documentsById.size };
  });
}
export const documentDto = row => ({ id: row.id, entryId: row.entry_id, name: row.name, folder: row.folder, extension: row.extension?.toUpperCase(), size: Number(row.size), modified: row.updated_at, url: `/api/files/${row.id}`, deletedAt: row.deleted_at, version: row.current_version });
export const documentSelect = `SELECT d.*,v.extension,v.size,v.root_kind,v.relative_path FROM documents d JOIN document_versions v ON v.id=d.current_version JOIN entries e ON e.id=d.entry_id`;
export const visibleWhere = 'd.deleted_at IS NULL AND e.deleted_at IS NULL AND e.published IS NOT NULL';
export async function catalog(db) {
  const { rows } = await db.query(`SELECT e.id,e.published,count(d.id)::integer AS count FROM entries e LEFT JOIN documents d ON d.entry_id=e.id AND d.deleted_at IS NULL WHERE e.deleted_at IS NULL AND e.published IS NOT NULL GROUP BY e.id ORDER BY e.published->>'name'`);
  const entries = rows.map(r => ({ ...r.published, id: r.id, documentCount: r.count, available: true }));
  return { entries, totalDocuments: entries.reduce((n, e) => n + e.documentCount, 0), indexedAt: new Date().toISOString() };
}
export async function fileRecord(db, documentId, staff = false) {
  const { rows } = await db.query(`${documentSelect} WHERE d.id=$1 ${staff ? '' : `AND ${visibleWhere}`}`, [documentId]);
  if (!rows[0]) throw fail(404, 'Không tìm thấy tài liệu.');
  const row = rows[0];
  const root = await realpath(row.root_kind === 'solutions' ? solutionsRoot : uploadsRoot);
  // Imported paths may have Windows separators; files are also served on Linux.
  const absolute = await realpath(path.resolve(root, row.relative_path.replaceAll('\\', '/')));
  const relative = path.relative(root, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw fail(403, 'Đường dẫn file không hợp lệ.');
  const info = await stat(absolute);
  if (!info.isFile()) throw fail(404, 'Không tìm thấy file.');
  return { absolute, doc: { ...documentDto(row), size: info.size } };
}
