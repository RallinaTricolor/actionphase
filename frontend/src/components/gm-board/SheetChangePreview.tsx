import { Badge } from '@/components/ui';
import { EntryCard } from '@/components/characters/sheet-items/EntryCard';
import { fieldChanges, stable, type SheetTabs } from '@/lib/gmBoard/rewards';
import type { SheetEntry } from '@/lib/sheetEntries';
import type { SheetTab } from '@/types/characters';

interface SheetChangePreviewProps {
  layout: readonly SheetTab[];
  before: SheetTabs;
  after: SheetTabs;
  /** The tabs to show: the ones the line's changes touch. */
  tabKeys: readonly string[];
}

type Row = { status: 'same' | 'new' | 'changed' | 'removed'; entry: SheetEntry; was?: SheetEntry };

const STATUS = {
  new: { label: 'New', variant: 'success', border: 'border-semantic-success' },
  changed: { label: 'Changed', variant: 'warning', border: 'border-semantic-warning' },
  removed: { label: 'Removed', variant: 'danger', border: 'border-semantic-danger' },
} as const;

/** A tab's entries after a change, in sheet order, each marked by what happened to it; removed ones where they were. */
function rowsFor(before: readonly SheetEntry[], after: readonly SheetEntry[]): Row[] {
  const rows: Row[] = after.map((entry) => {
    const was = before.find((e) => e.id === entry.id);
    if (!was) return { status: 'new', entry };
    return stable(was) === stable(entry) ? { status: 'same', entry } : { status: 'changed', entry, was };
  });
  before.forEach((was, i) => {
    if (after.some((e) => e.id === was.id)) return;
    const next = before.slice(i + 1).find((e) => after.some((a) => a.id === e.id));
    const at = next ? rows.findIndex((r) => r.entry.id === next.id) : rows.length;
    rows.splice(at, 0, { status: 'removed', entry: was });
  });
  return rows;
}

/**
 * The tabs a sheet change touches, read-only as the sheet shows them, with
 * what it changes marked: new, changed (with each field before and after) and
 * removed entries in full, the rest by name.
 */
export function SheetChangePreview({ layout, before, after, tabKeys }: SheetChangePreviewProps) {
  const tabs = layout.filter((t) => tabKeys.includes(t.key));
  if (!tabs.length) return null;
  return (
    <div className="space-y-4" data-testid="sheet-change-preview">
      {tabs.map((tab) => {
        const rows = rowsFor(before[tab.key] ?? [], after[tab.key] ?? []);
        return (
          <section key={tab.key} className="space-y-2" aria-label={`${tab.label} tab`} data-testid={`preview-tab-${tab.key}`}>
            <h5 className="text-sm font-semibold text-content-primary">{tab.label}</h5>
            {rows.length === 0 && <p className="text-sm text-content-tertiary">No entries.</p>}
            <ul className="space-y-2">
              {rows.map((row, i) => {
                if (row.status === 'same') {
                  return (
                    <li key={`same-${row.entry.id}-${i}`} className="rounded border border-theme-default px-3 py-1.5 text-sm text-content-secondary">
                      {row.entry.name}
                    </li>
                  );
                }
                const status = STATUS[row.status];
                const changes = row.was ? fieldChanges(tab, row.was, row.entry) : [];
                return (
                  <li key={`${row.status}-${row.entry.id}-${i}`} className={`space-y-2 border-l-4 pl-3 ${status.border}`} data-testid={`preview-${row.status}`}>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <Badge size="sm" variant={status.variant}>
                        {status.label}
                      </Badge>
                      {changes.length > 0 && (
                        <span className="text-sm text-content-secondary">
                          {changes.map((c) => `${c.label}: ${c.before} → ${c.after}`).join(' · ')}
                        </span>
                      )}
                    </div>
                    <div className={row.status === 'removed' ? 'opacity-60' : undefined}>
                      <EntryCard entry={row.entry} fields={tab.fields} canEdit={false} onUpdate={() => undefined} onRemove={() => undefined} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
