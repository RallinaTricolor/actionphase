/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**', // Exclude Playwright E2E tests
      'src/lib/__tests__/api.auth.test.ts',
      'src/lib/__tests__/api.games.test.ts',
      // CharacterSheet.test.tsx has module transformation issues in vitest
      // See CHARACTER_SHEET_TESTING_INVESTIGATION.md for details
      'src/components/__tests__/CharacterSheet.test.tsx',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/setupTests.ts',
        '**/*.test.{ts,tsx}',
        '**/__tests__/**',
      ],
    },
  },
  esbuild: {
    jsx: 'transform',
  },
})
