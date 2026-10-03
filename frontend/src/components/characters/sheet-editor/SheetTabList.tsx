import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Input } from '@/components/ui';
import type { SheetTab } from '@/types/characters';
import { DEFAULT_SHEET_LAYOUT } from '@/hooks/useSheetLayout';
import {
  SHEET_LIMITS,
  charactersWithTabData,
  labelProblem,
  missingBuiltInTabs,
  tabRemovalMessage,
  type CastSheetData,
} from '@/lib/sheetLayoutEditing';
import { ReorderButtons } from './ReorderButtons';
import { ConfirmRemoval } from './ConfirmRemoval';

interface SheetTabListProps {
  tabs: readonly SheetTab[];
  selectedKey: string | undefined;
  /** Keys of tabs with a problem somewhere in them. */
  tabsWithProblems: ReadonlySet<string>;
  cast: CastSheetData | undefined;
  /** Loot tables rolling into each tab, by tab key; undefined while loading. */
  lootTableCounts: ReadonlyMap<string, number> | undefined;
  /** Where the "loot tables" link in a guarded tab's note goes. */
  lootTablesHref: string;
  onSelect: (key: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (key: string) => void;
  onAdd: (label: string) => void;
  onRestore: (tab: SheetTab) => void;
}

/** Public Profile and Private Notes are platform features, not game ones: always first, never configurable. */
const FIXED_TABS = ['Public Profile', 'Private Notes'];

/** A tab's name as the sheet will show it: a blank built-in label falls back to the default. */
function displayLabel(tab: SheetTab): string {
  return tab.label.trim() || DEFAULT_SHEET_LAYOUT.find((t) => t.key === tab.key)?.label || 'Untitled tab';
}

/** The editor's list of tabs, in sheet order, with add, remove, restore and reorder. */
export function SheetTabList({
  tabs,
  selectedKey,
  tabsWithProblems,
  cast,
  lootTableCounts,
  lootTablesHref,
  onSelect,
  onMove,
  onRemove,
  onAdd,
  onRestore,
}: SheetTabListProps) {
  const id = useId();
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [attempted, setAttempted] = useState(false);
  const atTabLimit = tabs.length >= SHEET_LIMITS.tabs;
  const restorable = missingBuiltInTabs(tabs);
  const newLabelError = labelProblem(newLabel, SHEET_LIMITS.tabLabel, true);

  const requestRemove = (tab: SheetTab) => {
    const count = cast ? charactersWithTabData(cast, tab.key) : undefined;
    // Nothing stored on this tab: removing it hides nothing, so no prompt.
    if (count === 0) onRemove(tab.key);
    else setConfirmingKey(tab.key);
  };

  const submitNew = () => {
    setAttempted(true);
    if (newLabelError) return;
    onAdd(newLabel);
    setAdding(false);
    setNewLabel('');
    setAttempted(false);
  };

  return (
    <div className="space-y-3" data-testid="sheet-tab-list">
      <ul className="space-y-2">
        {FIXED_TABS.map((label) => (
          <li key={label} className="flex items-center justify-between gap-2 rounded-lg border border-theme-default surface-sunken px-3 py-2">
            <span className="text-sm text-content-secondary">{label}</span>
            <Badge variant="neutral" size="sm">Always shown</Badge>
          </li>
        ))}

        {tabs.map((tab, index) => {
          const label = displayLabel(tab);
          const selected = tab.key === selectedKey;
          const lootTables = lootTableCounts?.get(tab.key) ?? 0;
          return (
            <li key={tab.key} className="space-y-2" data-testid={`sheet-tab-row-${tab.key}`}>
              <div
                className={`flex items-center gap-1 rounded-lg border px-1 py-1 ${
                  selected ? 'border-interactive-primary surface-raised' : 'border-theme-default surface-base'
                }`}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="flex-1 min-w-0 justify-start text-left"
                  onClick={() => onSelect(tab.key)}
                  aria-current={selected ? 'true' : undefined}
                >
                  <span className="truncate">{label}</span>
                  {tabsWithProblems.has(tab.key) && (
                    <span className="ml-2 text-semantic-danger" aria-label="has problems">•</span>
                  )}
                </Button>
                <ReorderButtons
                  name={label}
                  canMoveUp={index > 0}
                  canMoveDown={index < tabs.length - 1}
                  onMove={(direction) => onMove(index, direction)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-semantic-danger"
                  onClick={() => requestRemove(tab)}
                  aria-label={`Remove ${label}`}
                  // Loot tables roll into this tab: removing it would unlink
                  // them, so they're retargeted or deleted first.
                  disabled={lootTables > 0}
                  aria-describedby={lootTables > 0 ? `${id}-loot-${tab.key}` : undefined}
                >
                  Remove
                </Button>
              </div>
              {lootTables > 0 && (
                <p id={`${id}-loot-${tab.key}`} className="px-1 text-xs text-content-secondary">
                  Used by{' '}
                  <Link to={lootTablesHref} className="text-interactive-primary hover:underline">
                    {lootTables} loot {lootTables === 1 ? 'table' : 'tables'}
                  </Link>
                  . Retarget or delete {lootTables === 1 ? 'it' : 'them'} to remove this tab.
                </p>
              )}
              {confirmingKey === tab.key && (
                <ConfirmRemoval
                  message={tabRemovalMessage(cast ? charactersWithTabData(cast, tab.key) : undefined, tab.isBuiltIn)}
                  onRemove={() => {
                    setConfirmingKey(null);
                    onRemove(tab.key);
                  }}
                  onKeep={() => setConfirmingKey(null)}
                />
              )}
            </li>
          );
        })}
      </ul>

      {adding ? (
        <div className="rounded-lg border border-theme-strong surface-raised p-3 space-y-2">
          <Input
            id={`${id}-new-tab`}
            label="New tab name"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNew();
            }}
            error={attempted ? newLabelError ?? undefined : undefined}
            inputSize="sm"
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="button" variant="primary" size="sm" onClick={submitNew}>Add tab</Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setAdding(false);
                setNewLabel('');
                setAttempted(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="secondary" size="sm" onClick={() => setAdding(true)} disabled={atTabLimit}>
          Add tab
        </Button>
      )}
      {atTabLimit && (
        <p className="text-xs text-content-tertiary">
          A sheet can have at most {SHEET_LIMITS.tabs} tabs besides Public Profile and Private Notes.
        </p>
      )}

      {restorable.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-content-secondary">Restore tab:</span>
          {restorable.map((tab) => (
            <Button
              key={tab.key}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onRestore(tab)}
              disabled={atTabLimit}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
