/// <reference types="vitest" />

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vite picks the next free port on its own when 5173 is taken, but a caller
  // that has to *know* the port up front cannot use that — it only learns
  // where the server landed after it has started. PORT lets the port be
  // assigned instead of discovered, which is what running several worktrees at
  // once needs. Unset, nothing changes.
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
});
