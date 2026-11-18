import { useMemo, useState } from 'react';
import {
  Combobox as HeadlessCombobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption as HeadlessOption,
  ComboboxOptions,
  Field,
  Label as HeadlessLabel,
} from '@headlessui/react';
import { tv } from '../../lib/theme/utils';

export interface ComboboxOption {
  value: string;
  label: string;
  /** A second line under the label, in the list only. */
  description?: string;
}

export type ComboboxSize = 'sm' | 'md';

export interface ComboboxProps {
  label: string;
  options: ComboboxOption[];
  /** The chosen option's value, or null for none yet. */
  value: string | null;
  onChange: (value: string) => void;
  /**
   * Allows a value that isn't in the list: typing one offers "Add …", and
   * choosing it calls this with the typed text (trimmed). The caller adds the
   * option and selects it.
   */
  onCreate?: (text: string) => void;
  /** The wording of the "Add …" row. Default: `Add “text”`. */
  createLabel?: (text: string) => string;
  placeholder?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  size?: ComboboxSize;
  'data-testid'?: string;
}

type Choice = ComboboxOption | { create: string };

const isCreate = (c: Choice | null): c is { create: string } => !!c && 'create' in c;

const inputStyles = tv({
  base: [
    'w-full rounded-md shadow-sm border transition-colors pr-8',
    'surface-base text-content-primary placeholder:text-content-tertiary',
    'focus:outline-none focus:ring-2 focus:ring-interactive-primary',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),
  variants: {
    variant: {
      default: 'border-theme-default focus:border-interactive-primary',
      error: 'border-semantic-danger focus:border-semantic-danger focus:ring-semantic-danger',
    },
    size: {
      sm: 'px-2 py-1 text-sm',
      md: 'px-3 py-2 text-base',
    },
  },
  defaultVariants: { variant: 'default', size: 'md' },
});

/**
 * A text field with a filtered list to pick from, keyboard-complete (arrows,
 * Enter, Escape). With `onCreate` it also takes a value that isn't in the
 * list, so it suits pickers that can grow: a location, a codex entry, a sheet
 * entry. Built on Headless UI's Combobox.
 *
 * @example
 * ```tsx
 * <Combobox
 *   label="Location"
 *   options={locations.map((l) => ({ value: l.id, label: l.name }))}
 *   value={card.locationId}
 *   onChange={setLocation}
 *   onCreate={addLocation}
 * />
 * ```
 */
export function Combobox({
  label,
  options,
  value,
  onChange,
  onCreate,
  createLabel = (text) => `Add “${text}”`,
  placeholder,
  helperText,
  error,
  disabled = false,
  size = 'md',
  'data-testid': testId,
}: ComboboxProps) {
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value) ?? null;

  const typed = query.trim();
  const shown = useMemo<Choice[]>(() => {
    const lc = typed.toLowerCase();
    const matches = lc ? options.filter((o) => o.label.toLowerCase().includes(lc)) : options;
    const exact = options.some((o) => o.label.toLowerCase() === lc);
    return onCreate && typed && !exact ? [...matches, { create: typed }] : matches;
  }, [options, typed, onCreate]);

  const choose = (choice: Choice | null) => {
    if (!choice) return;
    if (isCreate(choice)) onCreate?.(choice.create);
    else onChange(choice.value);
    setQuery('');
  };

  return (
    <Field className="w-full" disabled={disabled} data-testid={testId}>
      <HeadlessLabel className="block text-sm font-medium text-content-primary mb-2">{label}</HeadlessLabel>
      <HeadlessCombobox<Choice | null> value={selected} onChange={choose} onClose={() => setQuery('')} immediate>
        <div className="relative">
          <ComboboxInput<Choice | null>
            className={inputStyles({ variant: error ? 'error' : 'default', size })}
            displayValue={(c) => (c && !isCreate(c) ? c.label : '')}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            aria-invalid={error ? true : undefined}
          />
          <ComboboxButton
            className="absolute inset-y-0 right-0 flex items-center px-2 text-content-tertiary"
            aria-label={`Show ${label} options`}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
            </svg>
          </ComboboxButton>
          <ComboboxOptions className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-theme-default surface-raised shadow-lg py-1 text-sm empty:hidden">
            {shown.map((c) => (
              <HeadlessOption
                key={isCreate(c) ? '\u0000create' : c.value}
                value={c}
                className="cursor-pointer px-3 py-1.5 text-content-primary data-[focus]:surface-sunken data-[selected]:font-semibold"
              >
                {isCreate(c) ? (
                  <span className="text-interactive-primary">{createLabel(c.create)}</span>
                ) : (
                  <>
                    <span className="block">{c.label}</span>
                    {c.description && <span className="block text-xs text-content-tertiary">{c.description}</span>}
                  </>
                )}
              </HeadlessOption>
            ))}
          </ComboboxOptions>
        </div>
      </HeadlessCombobox>
      {error && <p className="mt-1 text-sm text-semantic-danger">{error}</p>}
      {!error && helperText && <p className="mt-1 text-sm text-content-secondary">{helperText}</p>}
    </Field>
  );
}
