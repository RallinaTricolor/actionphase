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
    env: {
      NODE_ENV: 'test',
    },

    // Vitest 4 flattened poolOptions into top-level options; minThreads,
    // singleThread and useAtomics no longer exist. maxWorkers replaces
    // maxThreads and limits concurrency to prevent resource exhaustion.
    //
    // 'forks' over 'threads': measured 2026-09-18 on 214 files / 3554 tests,
    // 110.5s -> 92.9s (-16%). Child processes get their own heap and GC rather
    // than contending inside one, which matters here because the Docker VM has
    // ~7.6GiB. Also sidesteps the IPC channel crashes this block originally
    // capped workers to avoid. 'vmThreads' looks tempting (it reuses a VM
    // context across files) but every file fails under it with "TransformStream
    // is not defined" -- MSW needs Node's web streams, which the VM context
    // does not expose.
    pool: 'forks',
    // 4 is measured-optimal, not arbitrary: 8 and 12 were both SLOWER on a
    // 12-CPU host (cumulative import 16.9s -> 41.1s at 12) because each extra
    // worker re-imports the whole module graph and the VM's memory, not the
    // host's cores, is the binding constraint. Re-measure before raising.
    maxWorkers: 4,

    // Timeout configuration for better cleanup
    testTimeout: 15000,  // Increased from default 5000ms
    teardownTimeout: 5000,
    hookTimeout: 10000,

    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**', // Exclude Playwright E2E tests
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/setupTests.ts',
        '**/*.test.{ts,tsx}',
        'src/test-utils/**',
        'src/mocks/**',
        'e2e/**',
      ],
    },
  },
  esbuild: {
    jsx: 'transform',
  },
})
