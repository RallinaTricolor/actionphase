import { defineConfig, mergeConfig } from 'vitest/config';
import base from '/app/vitest.config';

export default mergeConfig(base, defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
  },
}));
