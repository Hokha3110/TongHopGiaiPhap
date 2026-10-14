import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  for (const line of readFileSync(path.join(projectRoot, '.env'), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
} catch (error) { if (error.code !== 'ENOENT') throw error; }
export const solutionsRoot = path.resolve(process.env.SOLUTIONS_ROOT || path.join(projectRoot, 'Solutions'));
export const uploadsRoot = path.resolve(process.env.UPLOADS_ROOT || path.join(projectRoot, 'storage', 'uploads'));
export const uploadLimit = 90 * 1024 * 1024;
