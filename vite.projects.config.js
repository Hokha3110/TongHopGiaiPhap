import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repository, '');
  return {
    root: fileURLToPath(new URL('./projects', import.meta.url)),
    envDir: repository,
    publicDir: fileURLToPath(new URL('./projects/public', import.meta.url)),
    plugins: [react()],
    build: { outDir: fileURLToPath(new URL('./dist-works', import.meta.url)), emptyOutDir: true },
    server: {
      port: 5174,
      fs: { allow: [repository] },
      proxy: { '/api': `http://${env.HOST || '127.0.0.1'}:${Number(env.PORT) || 8787}` },
    },
  };
});
