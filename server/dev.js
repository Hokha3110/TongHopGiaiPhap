import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = spawn(process.execPath, [path.join(projectRoot, 'server', 'index.js')], { cwd: projectRoot, stdio: 'inherit', env: process.env });
const web = spawn(process.execPath, [path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')], { cwd: projectRoot, stdio: 'inherit', env: process.env });
let stopping = false;
let exitCode = 0;
function stop(code = 0) {
  if (!stopping) {
    stopping = true;
    exitCode = code;
    if (api.exitCode === null) api.kill();
    if (web.exitCode === null) web.kill();
  }
  if (api.exitCode !== null && web.exitCode !== null) process.exit(exitCode);
}
for (const child of [api, web]) {
  child.on('error', () => stop(1));
  child.on('exit', code => stop(code || 0));
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
