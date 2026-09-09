/// <reference types="vitest" />

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

/* PORT comes from `mobile/.env.local` alongside the other per-worktree values,
   so a worktree lands on its assigned port without anyone remembering a flag.
   Vite picks the next free port on its own, but a caller that has to *know* the
   port up front cannot use that — it only learns where the server landed after
   it has started. Unset, nothing changes. See docs/running.md. */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: env.PORT ? Number(env.PORT) : undefined,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.ts',
    },
  };
});
