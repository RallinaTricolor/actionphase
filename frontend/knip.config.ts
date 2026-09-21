import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: [
    'src/mocks/server.ts',
    'src/pages/*.tsx',
    'src/**/*.test.{ts,tsx}',
  ],
  project: ['src/**/*.{ts,tsx}'],

  vite: {
    config: ['vite.config.ts'],
  },
  playwright: {
    config: ['playwright.config.ts'],
  },
  vitest: {
    config: ['vitest.config.ts'],
  },

  // Barrel re-exports are real public API — don't flag their contents as unused
  includeEntryExports: true,

  ignore: [
    // UI component library — exports are intentional public API for consumers
    'src/components/ui/**',
  ],

  // Generated from the OpenAPI spec by `just gen-api-types`. We consume
  // `components`; the generator always emits paths/webhooks/operations/$defs
  // beside it, and they are not ours to delete.
  ignoreIssues: {
    'src/types/api.gen.ts': ['exports', 'types'],
  },

  ignoreDependencies: [
    // Driven by `just gen-api-types` / `just check-api-types`, not by an import,
    // so knip cannot see the usage.
    'openapi-typescript',
    // types for react-router-dom v5, kept for potential v5-compat imports — verify if truly needed
    '@types/react-router-dom',
    // dompurify ships its own types in newer versions; @types/dompurify still needed for TS to resolve them
    '@types/dompurify',
  ],
};

export default config;
