import { useState } from 'react';
import { Badge, Button, Combobox, Input, Select, Textarea } from '@/components/ui';
import { EntryCard } from '@/components/characters/sheet-items/EntryCard';
import { EntryForm } from '@/components/characters/sheet-items/EntryForm';
import { LootModeForm } from '@/components/characters/sheet-items/LootModeForm';
import { useLootDraw } from '@/hooks/useLootRoll';
import { applyOps, defaultOpTab, editOpFrom, fieldChanges, findEntry, mainNumberField, numberFields, type OpRecord, type SheetTabs } from '@/lib/gmBoard/rewards';
import type { SheetOp } from '@/lib/gmBoard/types';
import type { EntryEdit, SheetEntry } from '@/lib/sheetEntries';
import { lootDataToEdit } from '@/lib/sheetFieldValues';
import type { CharacterSheetField, SheetTab } from '@/types/characters';

interface SheetOpsEditorProps {
  ops: SheetOp[];
  onChange: (ops: SheetOp[]) => void;
  layout: readonly SheetTab[];
  /** The entries a tab already has, by name: the character's, or everyone's for a list item. */
  entryNames: (tabKey: string) => string[];
  /**
   * One character's sheet before each op (`lineSteps`). With it, each op picks
   * from the entries there at that point, Edit entry is on offer, and each op
   * shows what it does. A list item, given to many, has none.
   */
  steps?: readonly SheetTabs[];
  recs?: readonly OpRecord[];
  /** A list item can leave the entry blank, to be picked per person when given. */
  allowBlankEntry?: boolean;
  /** Prefix for test ids and labels, unique on the page. */
  idPrefix: string;
}

type Act = SheetOp['act'];
type AddOp = Extract<SheetOp, { act: 'add' }>;
type EditOp = Extract<SheetOp, { act: 'edit' }>;

const ACTS: { value: Act; label: string; perCharacter?: true }[] = [
  { value: 'inc', label: 'Add to a number' },
  { value: 'edit', label: 'Edit entry', perCharacter: true },
  { value: 'set', label: 'Set a field' },
  { value: 'add', label: 'New entry' },
  { value: 'remove', label: 'Remove entry' },
];

/** A fresh op of a kind, keeping the tab, and the entry when it names an existing one. */
function reshape(op: SheetOp, act: Act, tab: SheetTab | undefined): SheetOp {
  const base = { tab: op.tab, entry: op.act === 'add' ? '' : op.entry };
  if (act === 'inc') return { ...base, act, by: 1 };
  if (act === 'set') return { ...base, act, field: tab?.fields[0]?.key ?? '', value: '' };
  if (act === 'edit') return { ...base, act, values: {} };
  if (act === 'add') return { tab: op.tab, act, entry: '', fields: {} };
  return { ...base, act };
}

/** An entry form's save as a New entry op's name and fields. Empty fields are left out. */
function addFromEdit(op: AddOp, edit: EntryEdit): AddOp {
  const fields = Object.fromEntries(Object.entries(edit.values).filter(([, v]) => v !== undefined));
  return { ...op, entry: edit.name, fields };
}

/**
 * The sheet changes a line or list item makes, on any tab: add to a number or
 * track, edit an entry, set one field, add an entry, or remove one.
 *
 * New entry and Edit entry use the sheet's own entry form, and New entry its
 * loot tables, so what the board stores is what the sheet editor would. A
 * rolled item is stored in the op: working the line out again never rerolls.
 */
export function SheetOpsEditor({ ops, onChange, layout, entryNames, steps, recs, allowBlankEntry = false, idPrefix }: SheetOpsEditorProps) {
  const set = (i: number, op: SheetOp) => onChange(ops.map((o, j) => (j === i ? op : o)));
  const first = defaultOpTab(layout, ops);

  return (
    <div className="space-y-3" data-testid={`${idPrefix}-ops`}>
      {ops.map((op, i) => {
        const tab = layout.find((t) => t.key === op.tab);
        const before = steps?.[i];
        const names = before && tab ? (before[tab.key] ?? []).map((e) => e.name) : tab ? entryNames(tab.key) : [];
        const rec = recs?.[i];
        const acts = ACTS.filter((a) => !a.perCharacter || before || a.value === op.act);
        return (
          <div key={i} className="space-y-3 rounded-lg border border-theme-default surface-base p-3" data-testid={`${idPrefix}-op-${i}`}>
            <div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto]">
              <Select
                id={`${idPrefix}-tab-${i}`}
                label="Tab"
                value={op.tab}
                onChange={(e) => {
                  const next = layout.find((t) => t.key === e.target.value);
                  set(i, reshape({ ...op, tab: e.target.value }, op.act, next));
                }}
              >
                {!tab && <option value={op.tab}>{op.tab} (not on the sheet)</option>}
                {layout.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </Select>
              <Select id={`${idPrefix}-act-${i}`} label="Change" value={op.act} onChange={(e) => set(i, reshape(op, e.target.value as Act, tab))}>
                {acts.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </Select>
              {op.act === 'add' ? (
                <span className="hidden sm:block" />
              ) : (
                <EntryPicker
                  value={op.entry}
                  names={names}
                  allowBlank={allowBlankEntry}
                  onChange={(entry) => set(i, op.act === 'edit' ? { act: 'edit', tab: op.tab, entry, values: {} } : { ...op, entry })}
                  testId={`${idPrefix}-entry-${i}`}
                />
              )}
              <Button type="button" variant="ghost" aria-label="Remove this sheet change" onClick={() => onChange(ops.filter((_, j) => j !== i))}>
                ✕
              </Button>
            </div>
            {op.act !== 'add' && <EntryTag value={op.entry} names={names} testId={`${idPrefix}-entry-${i}-tag`} />}

            {tab && op.act === 'inc' && (
              <div className="grid gap-2 sm:grid-cols-2">
                {numberFields(tab).length > 1 && (
                  <Select id={`${idPrefix}-numfield-${i}`} label="Field" value={op.field || mainNumberField(tab)} onChange={(e) => set(i, { ...op, field: e.target.value })}>
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
                  value={String(op.by)}
                  placeholder="+1, -3, 0.5"
                  onChange={(e) => set(i, { ...op, by: Number(e.target.value) })}
                  data-testid={`${idPrefix}-by-${i}`}
                />
              </div>
            )}
            {tab && op.act === 'set' && (
              <div className="space-y-2">
                <Select id={`${idPrefix}-field-${i}`} label="Field" value={op.field} onChange={(e) => set(i, { ...op, field: e.target.value, value: '' })}>
                  {tab.fields.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </Select>
                <FieldInput id={`${idPrefix}-value-${i}`} field={tab.fields.find((f) => f.key === op.field)} label="New value" value={op.value} onChange={(value) => set(i, { ...op, value })} />
              </div>
            )}
            {tab && op.act === 'add' && <NewEntryOp op={op} tab={tab} onChange={(next) => set(i, next)} testId={`${idPrefix}-new-${i}`} />}
            {tab && op.act === 'edit' && <EditEntryOp op={op} tab={tab} before={before} onChange={(next) => set(i, next)} testId={`${idPrefix}-edit-${i}`} />}

            {rec && <OpOutcome rec={rec} tab={tab} testId={`${idPrefix}-outcome-${i}`} />}
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
        + Change
      </Button>
    </div>
  );
}

/** What an op did to this character's sheet, or why it can't. */
function OpOutcome({ rec, tab, testId }: { rec: OpRecord; tab: SheetTab | undefined; testId: string }) {
  if (rec.err) {
    return (
      <p className="text-sm text-semantic-danger" data-testid={testId}>
        {rec.err}
      </p>
    );
  }
  const field = rec.field && tab ? tab.fields.find((f) => f.key === rec.field)?.label ?? rec.field : undefined;
  const what = rec.op.act === 'inc' || rec.op.act === 'set' ? `${rec.entry} · ${field}: ${rec.before} → ${rec.after}` : null;
  if (!what && !rec.warn) return null;
  return (
    <p className="text-sm text-content-secondary" data-testid={testId}>
      {what}
      {rec.warn && <span className="ml-1 text-semantic-warning">{what ? `(${rec.warn})` : rec.warn}</span>}
    </p>
  );
}

/**
 * New entry: the sheet's own add form, with its loot table modes. Once filled
 * in, the entry shows as the sheet will, with Edit to change it.
 */
function NewEntryOp({ op, tab, onChange, testId }: { op: AddOp; tab: SheetTab; onChange: (op: AddOp) => void; testId: string }) {
  const blank = !op.entry.trim() && Object.keys(op.fields ?? {}).length === 0;
  const [editing, setEditing] = useState(blank);
  const draw = useLootDraw(
    0,
    (item) => {
      onChange(addFromEdit(op, lootDataToEdit(tab.fields, item.name, item.data)));
      setEditing(false);
    },
    (name) => `Rolled ${name}`,
  );
  // The entry as it will be stored, through the same codecs as everything else.
  const scratch: SheetTabs = { [tab.key]: [] };
  applyOps([tab], scratch, [op], () => 'new');
  const entry: SheetEntry | undefined = scratch[tab.key][0];

  if (editing) {
    return (
      <div className="rounded-lg border border-theme-default surface-raised p-3" data-testid={`${testId}-form`}>
        {blank ? (
          <LootModeForm
            fields={tab.fields}
            targetTab={tab.key}
            lootModes={draw.modes}
            onAdd={(edit) => {
              onChange(addFromEdit(op, edit));
              setEditing(false);
            }}
            onAddRandom={(tableId) => void draw.roll(tableId, tab.key)}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <EntryForm
            fields={tab.fields}
            initialEntry={entry}
            onSubmit={(edit) => {
              onChange(addFromEdit(op, edit));
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
            submitLabel="Save"
            variant="inline"
          />
        )}
      </div>
    );
  }
  return (
    <div className="space-y-2" data-testid={testId}>
      {entry ? (
        <EntryCard entry={entry} fields={tab.fields} canEdit={false} onUpdate={() => undefined} onRemove={() => undefined} />
      ) : (
        <p className="text-sm text-content-secondary">Nothing filled in yet.</p>
      )}
      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)} data-testid={`${testId}-edit`}>
        {entry ? 'Edit new entry' : 'Fill in the new entry'}
      </Button>
    </div>
  );
}

/**
 * Edit entry: the sheet's own edit form, opened on the entry as it stands at
 * this point in the phase. Only the fields the GM changes are kept.
 */
function EditEntryOp({ op, tab, before, onChange, testId }: { op: EditOp; tab: SheetTab; before: SheetTabs | undefined; onChange: (op: EditOp) => void; testId: string }) {
  const [editing, setEditing] = useState(false);
  const list = before?.[tab.key] ?? [];
  const entry = findEntry(list, op.entry);
  if (!entry) return <p className="text-sm text-content-secondary">Pick the entry to edit.</p>;

  const scratch: SheetTabs = { [tab.key]: [...list] };
  applyOps([tab], scratch, [op], () => 'x');
  const edited = scratch[tab.key].find((e) => e.id === entry.id) ?? entry;
  const changes = fieldChanges(tab, entry, edited);

  if (editing) {
    return (
      <div className="rounded-lg border border-theme-default surface-raised p-3" data-testid={`${testId}-form`}>
        <EntryForm
          fields={tab.fields}
          initialEntry={edited}
          onSubmit={(edit) => {
            onChange(editOpFrom(tab, entry, edit));
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          submitLabel="Save"
          variant="inline"
        />
      </div>
    );
  }
  return (
    <div className="space-y-2" data-testid={testId}>
      {changes.length ? (
        <ul className="space-y-1 text-sm">
          {changes.map((c) => (
            <li key={c.key} className="text-content-primary">
              <span className="font-medium">{c.label}:</span> <span className="text-content-secondary">{c.before}</span> → {c.after}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-content-secondary">No changes yet.</p>
      )}
      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)} data-testid={`${testId}-open`}>
        Edit {entry.name}
      </Button>
    </div>
  );
}

const entryList = (names: string[]) => names.map((name) => ({ id: name, name }));

/**
 * The entry an op names: the tab's entries to pick from, or a typed name. A
 * typed name that matches an entry but for capitals takes the entry's.
 */
function EntryPicker({ value, names, allowBlank, onChange, testId }: { value: string; names: string[]; allowBlank: boolean; onChange: (name: string) => void; testId: string }) {
  const existing = findEntry(entryList(names), value)?.name;
  const options = [
    ...(allowBlank ? [{ value: '', label: 'Pick per person' }] : []),
    ...names.map((n) => ({ value: n, label: n })),
    ...(value.trim() && !existing ? [{ value, label: value, description: 'Not on the sheet' }] : []),
  ];
  return (
    <Combobox
      label="Entry"
      options={options}
      value={value || (allowBlank ? '' : null)}
      onChange={onChange}
      onCreate={(text) => onChange(findEntry(entryList(names), text)?.name ?? text)}
      createLabel={(text) => `Use “${text}”`}
      placeholder="Entry name"
      data-testid={testId}
    />
  );
}

/** Under the row, so it doesn't push the row's inputs out of line. */
function EntryTag({ value, names, testId }: { value: string; names: string[]; testId: string }) {
  if (!value.trim() || findEntry(entryList(names), value)) return null;
  return (
    <Badge size="sm" variant="danger" data-testid={testId}>
      Not on the sheet
    </Badge>
  );
}

function FieldInput({ id, field, label, value, onChange }: { id: string; field: CharacterSheetField | undefined; label: string; value: unknown; onChange: (v: string) => void }) {
  const text = value === undefined || value === null ? '' : String(value);
  if (field?.type === 'checkbox')
    return (
      <Select id={id} label={label} value={text} onChange={(e) => onChange(e.target.value)}>
        <option value="" />
        <option value="true">Yes</option>
        <option value="false">No</option>
      </Select>
    );
  if (field?.type === 'select')
    return (
      <Select id={id} label={label} value={text} onChange={(e) => onChange(e.target.value)}>
        <option value="" />
        {(field.options ?? []).map((o) => (
          <option key={o}>{o}</option>
        ))}
      </Select>
    );
  if (field?.type === 'markdown') return <Textarea id={id} label={label} rows={5} value={text} onChange={(e) => onChange(e.target.value)} />;
  return <Input id={id} label={label} type={field?.type === 'number' || field?.type === 'track' ? 'number' : 'text'} step="any" value={text} onChange={(e) => onChange(e.target.value)} />;
}
