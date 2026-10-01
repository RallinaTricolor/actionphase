import { useMemo } from 'react';
import type {
  BuiltInSheetTabKey,
  CharacterSheetConfig,
  CharacterSheetField,
  SheetLayout,
  SheetTab,
} from '../types/characters';

/**
 * The default layout: each built-in tab's label and entry fields.
 *
 * **This is the only place in the app that knows these.** The backend
 * stores only what a GM actually changed and never fills defaults in, so an
 * absent config means "use these", which only works if exactly one place has
 * them. Adding a second copy (a placeholder typed inline, a fallback in a
 * component) reintroduces the drift this centralisation exists to prevent.
 * The one exception is server-written text (game log, exports), which names
 * the built-in tabs through `core.SheetTabLabel`; keep its labels the same.
 *
 * Field keys are the JSON keys existing entries already use, so today's data
 * lines up with these schemas with no migration. Each tab key is also identical
 * to its own default label, lower-cased.
 */
export const DEFAULT_SHEET_LAYOUT: readonly {
  readonly key: BuiltInSheetTabKey;
  readonly label: string;
  readonly fields: readonly CharacterSheetField[];
}[] = [
  {
    key: 'skills',
    label: 'Skills',
    fields: [
      { key: 'rank', label: 'Rank', type: 'text' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'description', label: 'Description', type: 'markdown' },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    fields: [
      { key: 'quantity', label: 'Quantity', type: 'number' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'value', label: 'Value', type: 'number' },
      { key: 'weight', label: 'Weight', type: 'number' },
      { key: 'description', label: 'Description', type: 'markdown' },
    ],
  },
  {
    key: 'numbers',
    label: 'Numbers',
    fields: [
      { key: 'amount', label: 'Amount', type: 'track' },
      { key: 'description', label: 'Description', type: 'markdown' },
    ],
  },
];

const DEFAULTS_BY_KEY = new Map(DEFAULT_SHEET_LAYOUT.map(tab => [tab.key as string, tab]));

/** Source of the config: a game, a cross-game character payload, or nothing. */
interface SheetLayoutSource {
  character_sheet?: CharacterSheetConfig;
}

/**
 * Resolves a game's character sheet layout, applying defaults for anything the
 * GM has not changed.
 *
 * Accepts undefined so callers can pass a game that has not loaded yet, or no
 * game at all (the utility drawer renders sheets outside a GameProvider). Both
 * correctly yield the default layout.
 */
export function useSheetLayout(source?: SheetLayoutSource | null): SheetLayout {
  const config = source?.character_sheet;

  return useMemo(() => resolveSheetLayout(config), [config]);
}

/**
 * Non-hook form, for the places that need the layout outside a render, and for
 * tests that check resolution without mounting a component.
 *
 * - No `tabs`: the default tabs, renamed by any legacy `labels` override.
 * - `tabs` present: exactly those tabs, in that order. Legacy `labels` are
 *   ignored (the backend drops them on save, so this only matters for a
 *   hand-edited row). A built-in tab without a label or fields gets its
 *   default label or fields.
 */
export function resolveSheetLayout(config?: CharacterSheetConfig | null): SheetLayout {
  // Absent and null both mean "default layout"; the generated type allows null.
  if (config?.tabs === undefined || config.tabs === null) {
    const labels = config?.labels;
    return {
      tabs: DEFAULT_SHEET_LAYOUT.map(tab => ({
        key: tab.key,
        label: pick(labels?.[tab.key], tab.label),
        fields: [...tab.fields],
        isBuiltIn: true,
      })),
    };
  }

  return {
    tabs: config.tabs.map((tab): SheetTab => {
      const defaults = DEFAULTS_BY_KEY.get(tab.key);
      if (defaults) {
        return {
          key: tab.key,
          label: pick(tab.label, defaults.label),
          // Nullish, not a length check: an emptied list is a GM who removed
          // every field, and must not bring the defaults back.
          fields: tab.fields ?? [...defaults.fields],
          isBuiltIn: true,
        };
      }
      // The backend requires both on a custom tab, so these floors only fire
      // for a hand-edited row. A tab whose name renders blank cannot be
      // pointed at at all.
      return {
        key: tab.key,
        label: pick(tab.label, 'Untitled tab'),
        fields: tab.fields ?? [],
        isBuiltIn: false,
      };
    }),
  };
}

/**
 * A stored label is honoured only if it has non-whitespace content. The backend
 * strips whitespace-only labels on the way in, so this is a floor for
 * hand-edited rows and for anything that predates that validation.
 */
function pick(override: string | undefined, fallback: string): string {
  const trimmed = override?.trim();
  return trimmed ? trimmed : fallback;
}
