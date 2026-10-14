import Busboy from 'busboy';
import { createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { uploadsRoot, uploadLimit } from './config.js';
import { id } from './security.js';
import { fail } from './db.js';

const allowed = new Set('pdf doc docx docm ppt pptx pptm xls xlsx xlsm odt odp ods csv txt md rtf png jpg jpeg webp gif mp4 webm mov mkv zip rar 7z vsdx'.split(' '));
export async function receiveFile(request) {
  await mkdir(uploadsRoot, { recursive: true });
  let filePath, result, problem;
  const writes = [];
  try {
    const parser = Busboy({ headers: request.headers, limits: { fileSize: uploadLimit, files: 1, fields: 0, parts: 2 } });
    await new Promise((resolve, reject) => {
      parser.on('file', (field, stream, info) => {
        const name = info.filename.replaceAll('\\', '/').split('/').pop();
        const extension = path.extname(name).slice(1).toLowerCase();
        if (field !== 'file' || !allowed.has(extension) || name.length > 240 || /[\x00-\x1f]/.test(name)) {
          problem = fail(400, 'Loại file hoặc tên file không được hỗ trợ.'); stream.resume(); return;
        }
        const relative = `${id()}.${extension}`;
        filePath = path.join(uploadsRoot, relative);
        result = { relative, name, extension };
        stream.on('limit', () => { problem = fail(413, 'File vượt quá 90 MB. Với file lớn, chép lên Solutions và nhập từ thư mục.'); });
        writes.push(pipeline(stream, createWriteStream(filePath, { flags: 'wx', mode: 0o600 })).catch(error => { problem = error; }));
      });
      parser.on('filesLimit', () => { problem = fail(400, 'Mỗi lần chỉ tải lên một file.'); });
      parser.on('fieldsLimit', () => { problem = fail(400, 'Yêu cầu tải lên không hợp lệ.'); });
      parser.on('partsLimit', () => { problem = fail(400, 'Mỗi lần chỉ tải lên một file.'); });
      parser.on('error', reject);
      parser.on('close', resolve);
      request.on('aborted', () => parser.destroy(fail(400, 'Tải lên bị ngắt.')));
      request.pipe(parser);
    });
    await Promise.all(writes);
    if (problem) throw problem;
    if (!result) throw fail(400, 'Chưa chọn file.');
    const info = await stat(filePath);
    if (!info.size) throw fail(400, 'File rỗng.');
    return { ...result, size: info.size, filePath };
  } catch (error) {
    await Promise.all(writes);
    if (filePath) await rm(filePath, { force: true });
    throw error.statusCode ? error : fail(400, 'Không nhận được file. Vui lòng thử lại.');
  }
}
