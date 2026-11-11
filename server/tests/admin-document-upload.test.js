import test from 'node:test';
import assert from 'node:assert/strict';
import { addUploadFiles, fileProblem, MAX_UPLOAD_BYTES, MAX_UPLOAD_FILES, normalizedText, uploadDocument } from '../../src/documentUpload.js';

const metadata = (name, size = 1024, lastModified = 10) => ({ name, size, lastModified });
test('multi-file queue validates limits, ignores repeated selections and preserves existing results', () => {
  const first = addUploadFiles([], [metadata('TMKT.pdf'), metadata('demo.pptx'), metadata('empty.xlsx', 0), metadata('big.zip', MAX_UPLOAD_BYTES + 1), metadata('run.exe')]);
  assert.deepEqual(first.rows.map(row => row.status), ['ready','ready','invalid','invalid','invalid']);
  first.rows[0].status = 'success';
  const second = addUploadFiles(first.rows, [metadata('TMKT.pdf'), metadata('TMKT.pdf', 1025), metadata('new.docx')]);
  assert.equal(second.duplicates, 1);
  assert.equal(second.rows[0].status, 'success');
  assert.equal(second.rows.length, 7);
  const capped = addUploadFiles([], Array.from({length: 35}, (_, i) => metadata(`${i}.pdf`)));
  assert.equal(capped.rows.length, MAX_UPLOAD_FILES);
  assert.equal(capped.overflow, 5);
  assert.equal(fileProblem(metadata('ok.XLSX', MAX_UPLOAD_BYTES)), '');
  assert.ok(fileProblem(metadata('bad\u0001.pdf')));
  assert.ok(fileProblem(metadata('x'.repeat(240) + '.pdf')));
  assert.equal(normalizedText('Định danh'), 'dinh danh');
});

function transport(status, body, event = 'load') {
  let request;
  const factory = () => request = {
    upload: {}, status, responseText: body,
    open(method, url) { this.method = method; this.url = url; },
    send(data) { this.data = data; queueMicrotask(() => { this.upload.onprogress({lengthComputable:true,loaded:9,total:10}); this[`on${event}`](); }); },
  };
  return { factory, request: () => request };
}
test('file upload uses credentialed requests, captures destination and waits for server confirmation', async () => {
  const file = new File(['test'], 'tmkt.pdf');
  const mock = transport(201, JSON.stringify({id:'saved-document'}));
  let progress = 0;
  const result = await uploadDocument(file, 'picus & docs', {xhrFactory:mock.factory,onProgress:value=>{progress=value;}});
  assert.equal(result.id, 'saved-document');
  assert.equal(mock.request().url, '/api/admin/documents?entryId=picus%20%26%20docs');
  assert.equal(mock.request().method, 'POST');
  assert.equal(mock.request().withCredentials, true);
  assert.equal(mock.request().data.get('file').name, 'tmkt.pdf');
  assert.equal(progress, 90);
  for (const event of ['error','timeout','abort']) {
    const failure = transport(0, '', event);
    await assert.rejects(uploadDocument(file, 'picus', {xhrFactory:failure.factory}), error => error.uncertain === true);
  }
  for (const [status, body] of [[502,'<html>Bad gateway</html>'],[500,'{"error":"db failed"}'],[200,'{}']]) {
    const failure = transport(status, body);
    await assert.rejects(uploadDocument(file, 'picus', {xhrFactory:failure.factory}), error => error.uncertain === true);
  }
  const unauthorized = transport(401, '{"error":"Unauthorized"}');
  await assert.rejects(uploadDocument(file, 'picus', {xhrFactory:unauthorized.factory}), error => error.status === 401 && !error.uncertain);
  const validation = transport(413, '{"error":"File quá lớn"}');
  await assert.rejects(uploadDocument(file, 'picus', {xhrFactory:validation.factory}), error => error.status === 413 && error.message === 'File quá lớn');
  let called = false;
  await assert.rejects(uploadDocument(new File([], 'empty.pdf'), 'picus', {xhrFactory:()=>{called=true;}}));
  await assert.rejects(uploadDocument(file, '', {xhrFactory:()=>{called=true;}}));
  assert.equal(called, false);
});
