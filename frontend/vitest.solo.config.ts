import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve('/app/src') } },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['/app/src/setupTests.ts'],
    testTimeout: 15000,
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
  },
  esbuild: { jsx: 'transform' },
});
