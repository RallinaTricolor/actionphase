import { DEFAULT_SHEET_LAYOUT } from '@/hooks/useSheetLayout';
import { normalizeEntry, type RawSheetEntry, type SheetEntry } from '@/lib/sheetEntries';
import {
  storageFieldName,
  type CharacterData,
  type CharacterSheetConfig,
  type CharacterSheetField,
  type SheetTab,
} from '@/types/characters';

/**
 * The editor's side of the Character Sheet editor: the rules a layout must
 * meet, and the conversion from what the GM edits to what is stored.
 *
 * Kept free of React so the rules can be tested directly. The backend enforces
 * every rule here again (`ValidateCharacterSheetConfig`); these exist so the
 * GM sees a problem beside the field that has it, not as a 422 after Save.
 */

export type SheetFieldType = CharacterSheetField['type'];

/** Mirrors the layout limits in the backend's character_sheet_config.go. */
export const SHEET_LIMITS = {
  tabs: 8,
  fieldsPerTab: 12,
  tabLabel: 24,
  fieldLabel: 40,
  selectOptions: 20,
  selectOption: 40,
} as const;

/** What the editor calls each field type, and what it is for. */
export const FIELD_TYPES: readonly { type: SheetFieldType; label: string; hint: string }[] = [
  { type: 'text', label: 'Text', hint: 'A short line, shown as "Label: value"' },
  { type: 'number', label: 'Number', hint: 'A number, shown as "Label: value"' },
  { type: 'markdown', label: 'Long text', hint: 'Markdown, shown as a section that expands' },
  { type: 'select', label: 'Choice', hint: 'One of a fixed list, shown as a badge' },
  { type: 'checkbox', label: 'Checkbox', hint: 'Yes or no, shown as a badge when checked' },
  { type: 'track', label: 'Track', hint: 'A current value with an optional maximum, drawn as a bar or boxes' },
];

export function fieldTypeLabel(type: string): string {
  return FIELD_TYPES.find((t) => t.type === type)?.label ?? type;
}

/** The key new custom tabs start from. `description` is valid on any tab. */
const STARTER_FIELD: CharacterSheetField = { key: 'description', label: 'Description', type: 'markdown' };

// Counted in code points, as the backend counts runes. `.length` would count
// UTF-16 units and reject labels the server accepts.
const runeLength = (value: string) => [...value].length;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;

/**
 * What is wrong with a label, or null. Mirrors the backend's
 * normalizeSheetLabel, which trims first: surrounding whitespace is fine.
 */
export function labelProblem(raw: string, max: number, required: boolean): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return required ? 'Needs a name.' : null;
  if (runeLength(trimmed) > max) return `Must be ${max} characters or fewer.`;
  if (CONTROL_CHARACTERS.test(trimmed)) return 'Must not contain control characters.';
  return null;
}

/** One problem with a draft layout. `tabKey` and `fieldKey` say where it is. */
export interface LayoutProblem {
  tabKey?: string;
  fieldKey?: string;
  message: string;
}

/** Every problem with a draft layout. Empty means the backend will accept it. */
export function layoutProblems(tabs: readonly SheetTab[]): LayoutProblem[] {
  const problems: LayoutProblem[] = [];

  if (tabs.length > SHEET_LIMITS.tabs) {
    problems.push({ message: `A character sheet can have at most ${SHEET_LIMITS.tabs} tabs besides Public Profile and Private Notes.` });
  }

  for (const tab of tabs) {
    // A built-in tab's blank label means "use the default name".
    const tabLabel = labelProblem(tab.label, SHEET_LIMITS.tabLabel, !tab.isBuiltIn);
    if (tabLabel) problems.push({ tabKey: tab.key, message: `Tab name: ${tabLabel}` });

    if (tab.fields.length > SHEET_LIMITS.fieldsPerTab) {
      problems.push({ tabKey: tab.key, message: `A tab can have at most ${SHEET_LIMITS.fieldsPerTab} fields.` });
    }

    for (const field of tab.fields) {
      const at = { tabKey: tab.key, fieldKey: field.key };
      const fieldLabel = labelProblem(field.label, SHEET_LIMITS.fieldLabel, true);
      if (fieldLabel) problems.push({ ...at, message: `Field name: ${fieldLabel}` });
      if (field.type === 'select') {
        problems.push(...optionProblems(field.options ?? []).map((message) => ({ ...at, message })));
      }
    }
  }

  return problems;
}

/** What is wrong with a select field's options. */
export function optionProblems(options: readonly string[]): string[] {
  const problems: string[] = [];
  if (options.length === 0) problems.push('A choice needs at least one option.');
  if (options.length > SHEET_LIMITS.selectOptions) {
    problems.push(`A choice can have at most ${SHEET_LIMITS.selectOptions} options.`);
  }
  const seen = new Set<string>();
  for (const option of options) {
    const problem = labelProblem(option, SHEET_LIMITS.selectOption, true);
    if (problem) {
      problems.push(`Option "${option.trim() || '(blank)'}": ${problem}`);
      continue;
    }
    const trimmed = option.trim();
    if (seen.has(trimmed)) problems.push(`Option "${trimmed}" is listed more than once.`);
    seen.add(trimmed);
  }
  return problems;
}

/** Options as the GM types them: one per line, blank lines ignored. */
export function parseOptions(text: string): string[] {
  return text.split('\n').map((line) => line.trim()).filter(Boolean);
}

const KEY_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * A fresh key: the prefix plus six random lower-case letters or digits, the
 * shape the backend requires of custom tab (`t_`) and field (`f_`) keys.
 *
 * Keys never change once made, so a later rename can't orphan stored data.
 */
export function generateKey(prefix: 't_' | 'f_', taken: ReadonlySet<string>): string {
  for (;;) {
    let suffix = '';
    for (let i = 0; i < 6; i++) {
      suffix += KEY_ALPHABET[Math.floor(Math.random() * KEY_ALPHABET.length)];
    }
    const key = prefix + suffix;
    if (!taken.has(key)) return key;
  }
}

/** A new custom tab: every entry has a name, and this starts it with a description. */
export function newCustomTab(label: string, takenKeys: ReadonlySet<string>): SheetTab {
  return {
    key: generateKey('t_', takenKeys),
    label: label.trim(),
    fields: [{ ...STARTER_FIELD }],
    isBuiltIn: false,
  };
}

/** A new field. Only a select carries options. */
export function newField(
  label: string,
  type: SheetFieldType,
  options: readonly string[],
  takenKeys: ReadonlySet<string>,
): CharacterSheetField {
  return {
    key: generateKey('f_', takenKeys),
    label: label.trim(),
    type,
    ...(type === 'select' ? { options: options.map((o) => o.trim()) } : {}),
  };
}

const defaultTab = (key: string) => DEFAULT_SHEET_LAYOUT.find((tab) => tab.key === key);

/**
 * A built-in tab's default fields that the draft no longer has. Restoring one
 * brings its stored values back, since the key is the same.
 */
export function missingDefaultFields(tab: SheetTab): CharacterSheetField[] {
  if (!tab.isBuiltIn) return [];
  const present = new Set(tab.fields.map((field) => field.key));
  return (defaultTab(tab.key)?.fields ?? []).filter((field) => !present.has(field.key)).map((field) => ({ ...field }));
}

/** Built-in tabs the draft has removed, in their default order. */
export function missingBuiltInTabs(tabs: readonly SheetTab[]): SheetTab[] {
  const present = new Set(tabs.map((tab) => tab.key));
  return DEFAULT_SHEET_LAYOUT.filter((tab) => !present.has(tab.key)).map((tab) => ({
    key: tab.key,
    label: tab.label,
    fields: tab.fields.map((field) => ({ ...field })),
    isBuiltIn: true,
  }));
}

/** A field as it is stored: labels and options trimmed, options only on a select. */
function storedField(field: CharacterSheetField): CharacterSheetField {
  return {
    key: field.key,
    label: field.label.trim(),
    type: field.type,
    ...(field.type === 'select' ? { options: (field.options ?? []).map((o) => o.trim()) } : {}),
  };
}

function sameFields(a: readonly CharacterSheetField[], b: readonly CharacterSheetField[]): boolean {
  return JSON.stringify(a.map(storedField)) === JSON.stringify(b.map(storedField));
}

/**
 * The config to store for a draft layout.
 *
 * Sparse, like everything the backend keeps: a built-in tab carries its label
 * only when renamed and its fields only when changed, so a later change to the
 * defaults still reaches every tab the GM left alone. A layout identical to
 * the default saves as `{}`, which also clears any legacy `labels`.
 */
export function toSheetConfig(tabs: readonly SheetTab[]): CharacterSheetConfig {
  const stored = tabs.map((tab) => {
    const fields = tab.fields.map(storedField);
    const label = tab.label.trim();
    const defaults = tab.isBuiltIn ? defaultTab(tab.key) : undefined;
    if (!defaults) return { key: tab.key, label, fields };
    return {
      key: tab.key,
      ...(label && label !== defaults.label ? { label } : {}),
      ...(sameFields(fields, defaults.fields) ? {} : { fields }),
    };
  });

  const isDefault =
    stored.length === DEFAULT_SHEET_LAYOUT.length &&
    stored.every((tab, i) => tab.key === DEFAULT_SHEET_LAYOUT[i].key && Object.keys(tab).length === 1);

  return isDefault ? {} : { tabs: stored };
}

// Stored values that show nothing on a card: an unchecked checkbox is stored as
// absent, and an emptied text as absent too, but older rows may hold either.
const hasValue = (value: unknown) => value !== undefined && value !== null && value !== '' && value !== false;

function tabEntries(rows: readonly CharacterData[], tabKey: string): RawSheetEntry[] {
  const row = rows.find((r) => r.module_type === tabKey && r.field_name === storageFieldName(tabKey));
  if (!row?.field_value) return [];
  try {
    const parsed: unknown = JSON.parse(row.field_value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Every character's sheet rows, keyed by character id, as `getGameCharacterData` returns them. */
export type CastSheetData = Record<string, CharacterData[]>;

/** How many characters have at least one entry on a tab. */
export function charactersWithTabData(cast: CastSheetData | undefined, tabKey: string): number {
  if (!cast) return 0;
  return Object.values(cast).filter((rows) => tabEntries(rows, tabKey).length > 0).length;
}

/**
 * How many characters have a value in a field on a tab. Read through
 * normalizeEntry, so a legacy key (Skills' `level`) counts toward the field
 * it now feeds (`rank`).
 */
export function charactersWithFieldData(cast: CastSheetData | undefined, tabKey: string, fieldKey: string): number {
  if (!cast) return 0;
  return Object.values(cast).filter((rows) =>
    // An id-less entry (a loot roll) still counts; normalizeEntry only needs one to carry.
    tabEntries(rows, tabKey).some((entry) => hasValue(normalizeEntry(tabKey, { ...entry, id: entry.id ?? '' })[fieldKey])),
  ).length;
}

const SAMPLE_VALUES: Record<SheetFieldType, (field: CharacterSheetField) => unknown> = {
  text: () => 'Example',
  number: () => 3,
  markdown: () => 'A few lines of description.',
  select: (field) => field.options?.map((o) => o.trim()).find(Boolean),
  checkbox: () => true,
  track: () => ({ value: 3, max: 5, display: 'track' }),
};

/** A made-up entry that fills every field, for the editor's preview card. */
export function sampleEntry(fields: readonly CharacterSheetField[]): SheetEntry {
  const entry: SheetEntry = { id: 'preview', name: 'Sample entry' };
  for (const field of fields) {
    const value = SAMPLE_VALUES[field.type]?.(field);
    if (value !== undefined) entry[field.key] = value;
  }
  return entry;
}

const charactersHave = (count: number) => (count === 1 ? '1 character has' : `${count} characters have`);

/**
 * What removing a tab does to stored entries, for the confirmation. `count` is
 * undefined while the cast's data is still loading.
 *
 * Removal only edits the layout: entries stay in each character's row. A
 * built-in tab can be restored, which shows them again; a custom tab can't,
 * because nothing lists a removed custom tab's key.
 */
export function tabRemovalMessage(count: number | undefined, isBuiltIn: boolean): string {
  const who = count === undefined ? 'Any entries here' : `${charactersHave(count)} entries here. They`;
  const verb = count === undefined ? 'will be' : "'ll be";
  const after = isBuiltIn
    ? 'Restoring the tab shows them again.'
    : "A removed custom tab can't be restored.";
  return `${who}${count === undefined ? ' ' : ''}${verb} hidden, not deleted. ${after}`;
}

/** What removing a field does to stored values, for the confirmation. */
export function fieldRemovalMessage(count: number | undefined, isDefaultField: boolean): string {
  const lead = count === undefined
    ? 'Any values in this field will be hidden, not deleted.'
    : `${charactersHave(count)} a value in this field. It'll be hidden, not deleted.`;
  const after = isDefaultField
    ? 'Restoring the default field shows it again.'
    : "A removed custom field can't be restored.";
  return `${lead} ${after}`;
}
