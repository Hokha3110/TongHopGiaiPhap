import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiHost = env.HOST || '127.0.0.1';
  const apiPort = Number(env.PORT || 8787);
  return {
    plugins: [react()],
    server: {
      proxy: { '/api': `http://${apiHost}:${apiPort}` },
    },
  };
});
