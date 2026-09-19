import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Guard the domain organization of `src/components/`.
 *
 * `components/` was flat until 2026-09-19: ~160 modules plus an 80-file
 * `__tests__/` directory, all in one namespace. It was reorganized into
 * subdirectories mirroring the backend's bounded contexts
 * (`backend/pkg/<domain>/`), so a component's domain is visible from its path.
 *
 * Flat layouts regrow one file at a time — nobody decides to undo the
 * reorganization, they just add `NewThing.tsx` at the top level because that
 * is one keystroke shorter. This test makes that a failing build instead of a
 * silent regression, which is the same job `retired-tokens.test.ts` does for
 * design tokens.
 *
 * `ui/` is the design-system library and `common/` holds genuinely
 * cross-cutting pieces; both are directories like any other, so neither needs
 * an exemption here.
 */
const COMPONENTS = join(process.cwd(), 'src', 'components');

describe('components/ organization', () => {
  it('has no modules sitting directly in src/components/', () => {
    const loose = readdirSync(COMPONENTS)
      .filter((entry) => !statSync(join(COMPONENTS, entry)).isDirectory())
      .filter((entry) => /\.(tsx?|jsx?)$/.test(entry));

    // A new component belongs in a domain directory — components/games/,
    // components/messages/, etc. — or components/common/ if it is genuinely
    // cross-cutting. Import it elsewhere as @/components/<domain>/<Name>.
    expect(loose).toEqual([]);
  });

  it('has no leftover components/__tests__/ directory', () => {
    // Tests are co-located beside the component they cover. The old shared
    // components/__tests__/ directory separated each test from its subject and
    // was dissolved during the reorganization.
    const dirs = readdirSync(COMPONENTS).filter((entry) =>
      statSync(join(COMPONENTS, entry)).isDirectory()
    );

    expect(dirs).not.toContain('__tests__');
  });
});
