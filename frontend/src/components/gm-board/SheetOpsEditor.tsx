import { Badge, Button, Combobox, Input, Select, Textarea } from '@/components/ui';
import { defaultOpTab, findEntry, mainNumberField, numberFields } from '@/lib/gmBoard/rewards';
import type { SheetOp } from '@/lib/gmBoard/types';
import type { CharacterSheetField, SheetTab } from '@/types/characters';

interface SheetOpsEditorProps {
  ops: SheetOp[];
  onChange: (ops: SheetOp[]) => void;
  layout: readonly SheetTab[];
  /** The entries a tab already has, by name: the character's, or everyone's for a list item. */
  entryNames: (tabKey: string) => string[];
  /** A list item can leave the entry blank, to be picked per person when given. */
  allowBlankEntry?: boolean;
  /** Prefix for test ids and labels, unique on the page. */
  idPrefix: string;
}

const ACTS: { value: SheetOp['act']; label: string }[] = [
  { value: 'inc', label: 'Add to a number' },
  { value: 'set', label: 'Set a field' },
  { value: 'add', label: 'New entry' },
  { value: 'remove', label: 'Remove entry' },
];

/** A fresh op of a kind, keeping the tab and entry. */
function reshape(op: SheetOp, act: SheetOp['act'], tab: SheetTab | undefined): SheetOp {
  const base = { tab: op.tab, entry: op.entry };
  if (act === 'inc') return { ...base, act, by: 1 };
  if (act === 'set') return { ...base, act, field: tab?.fields[0]?.key ?? '', value: '' };
  if (act === 'add') return { ...base, act, fields: {} };
  return { ...base, act };
}

/**
 * The sheet changes a reward makes, on any tab: add to a number or track, set
 * a field, add an entry with the tab's fields, or remove one. The entry name
 * is picked from the tab's entries, or typed new.
 */
export function SheetOpsEditor({ ops, onChange, layout, entryNames, allowBlankEntry = false, idPrefix }: SheetOpsEditorProps) {
  const set = (i: number, op: SheetOp) => onChange(ops.map((o, j) => (j === i ? op : o)));
  const first = defaultOpTab(layout, ops);

  return (
    <div className="space-y-3" data-testid={`${idPrefix}-ops`}>
      {ops.map((op, i) => {
        const tab = layout.find((t) => t.key === op.tab);
        return (
          <div key={i} className="space-y-2 rounded border border-theme-default p-2" data-testid={`${idPrefix}-op-${i}`}>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto] items-end gap-2">
              <Select
                id={`${idPrefix}-tab-${i}`}
                label="Tab"
                selectSize="sm"
                value={op.tab}
                onChange={(e) => {
                  const next = layout.find((t) => t.key === e.target.value);
                  set(i, reshape({ ...op, tab: e.target.value, entry: op.entry }, op.act, next));
                }}
              >
                {!tab && <option value={op.tab}>{op.tab} (not on the sheet)</option>}
                {layout.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </Select>
              <Select id={`${idPrefix}-act-${i}`} label="Change" selectSize="sm" value={op.act} onChange={(e) => set(i, reshape(op, e.target.value as SheetOp['act'], tab))}>
                {ACTS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </Select>
              <EntryPicker
                value={op.entry}
                names={tab ? entryNames(tab.key) : []}
                isNew={op.act === 'add'}
                allowBlank={allowBlankEntry}
                onChange={(entry) => set(i, { ...op, entry })}
                testId={`${idPrefix}-entry-${i}`}
              />
              <Button type="button" size="sm" variant="ghost" aria-label="Remove this sheet change" onClick={() => onChange(ops.filter((_, j) => j !== i))}>
                ✕
              </Button>
            </div>
            {tab && op.act === 'inc' && (
              <div className="grid grid-cols-2 gap-2">
                {numberFields(tab).length > 1 && (
                  <Select id={`${idPrefix}-numfield-${i}`} label="Field" selectSize="sm" value={op.field || mainNumberField(tab)} onChange={(e) => set(i, { ...op, field: e.target.value })}>
                    {numberFields(tab).map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                )}
                <Input
                  id={`${idPrefix}-by-input-${i}`}
                  label="By"
                  type="number"
                  step="any"
                  inputSize="sm"
                  value={String(op.by)}
                  placeholder="+1, -3, 0.5"
                  onChange={(e) => set(i, { ...op, by: Number(e.target.value) })}
                  data-testid={`${idPrefix}-by-${i}`}
                />
              </div>
            )}
            {tab && op.act === 'set' && (
              <div className="grid grid-cols-2 gap-2">
                <Select id={`${idPrefix}-field-${i}`} label="Field" selectSize="sm" value={op.field} onChange={(e) => set(i, { ...op, field: e.target.value, value: '' })}>
                  {tab.fields.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </Select>
                <FieldInput id={`${idPrefix}-value-${i}`} field={tab.fields.find((f) => f.key === op.field)} label="New value" value={op.value} onChange={(value) => set(i, { ...op, value: String(value) })} />
              </div>
            )}
            {tab && op.act === 'add' && (
              <div className="grid grid-cols-2 gap-2">
                {tab.fields.map((f) => (
                  <FieldInput key={f.key} id={`${idPrefix}-new-${i}-${f.key}`} field={f} label={f.label} value={op.fields[f.key] ?? ''} onChange={(value) => set(i, { ...op, fields: { ...op.fields, [f.key]: value } })} />
                ))}
              </div>
            )}
          </div>
        );
      })}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={!first}
        onClick={() => first && onChange([...ops, { act: 'inc', tab: first.key, entry: '', by: 1 }])}
        data-testid={`${idPrefix}-add-op`}
      >
        + Sheet change
      </Button>
    </div>
  );
}

/**
 * The entry an op names: the tab's entries to pick from, or a new name. A
 * typed name that matches an entry but for capitals takes the entry's.
 */
function EntryPicker({
  value,
  names,
  isNew,
  allowBlank,
  onChange,
  testId,
}: {
  value: string;
  names: string[];
  isNew: boolean;
  allowBlank: boolean;
  onChange: (name: string) => void;
  testId: string;
}) {
  const existing = findEntry(names.map((name) => ({ id: name, name })), value)?.name;
  const tag = !value.trim() ? null : isNew ? (existing ? 'Already on the sheet' : 'New entry') : existing ? null : 'Not on the sheet';
  const options = [
    ...(allowBlank ? [{ value: '', label: 'Pick per person' }] : []),
    ...names.map((n) => ({ value: n, label: n })),
    ...(value.trim() && !existing ? [{ value, label: value, description: tag ?? undefined }] : []),
  ];
  return (
    <div>
      <Combobox
        label="Entry"
        size="sm"
        options={options}
        value={value || (allowBlank ? '' : null)}
        onChange={onChange}
        onCreate={(text) => onChange(findEntry(names.map((name) => ({ id: name, name })), text)?.name ?? text)}
        createLabel={(text) => (isNew ? `New entry “${text}”` : `Use “${text}”`)}
        placeholder={isNew ? 'New entry name' : 'Entry name'}
        data-testid={testId}
      />
      {tag && (
        <Badge size="sm" variant={tag === 'New entry' ? 'primary' : tag === 'Already on the sheet' ? 'warning' : 'danger'} className="mt-1" data-testid={`${testId}-tag`}>
          {tag}
        </Badge>
      )}
    </div>
  );
}

function FieldInput({ id, field, label, value, onChange }: { id: string; field: CharacterSheetField | undefined; label: string; value: unknown; onChange: (v: string) => void }) {
  const text = value === undefined || value === null ? '' : String(value);
  if (field?.type === 'checkbox')
    return (
      <Select id={id} label={label} selectSize="sm" value={text} onChange={(e) => onChange(e.target.value)}>
        <option value="" />
        <option value="true">Yes</option>
        <option value="false">No</option>
      </Select>
    );
  if (field?.type === 'select')
    return (
      <Select id={id} label={label} selectSize="sm" value={text} onChange={(e) => onChange(e.target.value)}>
        <option value="" />
        {(field.options ?? []).map((o) => (
          <option key={o}>{o}</option>
        ))}
      </Select>
    );
  if (field?.type === 'markdown') return <Textarea id={id} label={label} rows={2} value={text} onChange={(e) => onChange(e.target.value)} />;
  return <Input id={id} label={label} inputSize="sm" type={field?.type === 'number' || field?.type === 'track' ? 'number' : 'text'} step="any" value={text} onChange={(e) => onChange(e.target.value)} />;
}
