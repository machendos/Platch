/// <reference types="vitest" />

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

/* PORT comes from `mobile/.env.local` alongside the other per-worktree values,
   so a worktree lands on its assigned port without anyone remembering a flag.
   Vite picks the next free port on its own, but a caller that has to *know* the
   port up front cannot use that — it only learns where the server landed after
   it has started. Unset, nothing changes.

   `/api` is proxied to the same VITE_API_HOST the client would otherwise call
   directly, so that a browser reaches the backend same-origin. See
   docs/running.md. */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: env.PORT ? Number(env.PORT) : undefined,
      proxy: {
        '/api': {
          target: env.VITE_API_HOST || 'http://localhost:3001',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.ts',
    },
  };
});
