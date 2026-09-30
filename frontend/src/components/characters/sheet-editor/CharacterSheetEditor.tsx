import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, CardBody, CardHeader } from '@/components/ui';
import { resolveSheetLayout } from '@/hooks/useSheetLayout';
import { useGameCharacterData, useLootTableTargetCounts, useUpdateCharacterSheet } from '@/hooks/useCharacterSheetLayout';
import { useToast } from '@/contexts/ToastContext';
import { extractApiErrorMessage } from '@/lib/errors';
import { layoutProblems, newCustomTab, toSheetConfig } from '@/lib/sheetLayoutEditing';
import type { CharacterSheetConfig, SheetTab } from '@/types/characters';
import { SheetTabList } from './SheetTabList';
import { SheetTabDetail } from './SheetTabDetail';
import { ConfirmRemoval } from './ConfirmRemoval';

interface CharacterSheetEditorProps {
  gameId: number;
  /** The game's stored layout. */
  config: CharacterSheetConfig | undefined;
  /** Reports whether the draft differs from what is saved, for the page's leave guard. */
  onDirtyChange?: (isDirty: boolean) => void;
}

/** Compared as stored, so whitespace the backend would trim away is not a change. */
const savedForm = (tabs: readonly SheetTab[]) => JSON.stringify(toSheetConfig(tabs));

/**
 * Huma reports a rejected layout as `detail: "validation failed"` with the
 * reason in `errors[]`, so read those first; extractApiErrorMessage prefers
 * the generic detail.
 */
function saveErrorMessage(error: unknown): string {
  const errors = (error as { response?: { data?: { errors?: { message?: unknown }[] } } })?.response?.data?.errors;
  const reasons = (errors ?? []).map((e) => e?.message).filter((m): m is string => typeof m === 'string' && m !== '');
  if (reasons.length > 0) return reasons.join('. ');
  return extractApiErrorMessage(error) ?? 'Failed to save the character sheet. Please try again.';
}

function move<T>(list: readonly T[], index: number, direction: -1 | 1): T[] {
  const next = [...list];
  [next[index], next[index + direction]] = [next[index + direction], next[index]];
  return next;
}

/**
 * The GM's Character Sheet editor: which tabs a game's sheet has, in what
 * order, and what fields each tab's entries carry.
 *
 * Everything is a draft until Save, which replaces the whole layout. Removing a
 * tab or field only changes the layout: stored entries are kept, hidden.
 */
export function CharacterSheetEditor({ gameId, config, onDirtyChange }: CharacterSheetEditorProps) {
  const { showSuccess } = useToast();
  const saveMutation = useUpdateCharacterSheet(gameId);
  const { data: cast } = useGameCharacterData(gameId);
  const lootTableCounts = useLootTableTargetCounts(gameId);

  const [tabs, setTabs] = useState<SheetTab[]>(() => resolveSheetLayout(config).tabs);
  const [baseline, setBaseline] = useState(() => savedForm(tabs));
  const [selectedKey, setSelectedKey] = useState<string | undefined>(() => tabs[0]?.key);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const isDirty = savedForm(tabs) !== baseline;
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const problems = useMemo(() => layoutProblems(tabs), [tabs]);
  const tabsWithProblems = useMemo(
    () => new Set(problems.map((p) => p.tabKey).filter((key): key is string => !!key)),
    [problems],
  );
  // The picked tab, or the first one once the picked tab is removed.
  const selected = tabs.find((tab) => tab.key === selectedKey) ?? tabs[0];

  const replaceTab = (next: SheetTab) => setTabs((prev) => prev.map((tab) => (tab.key === next.key ? next : tab)));

  const addTab = (label: string) => {
    const tab = newCustomTab(label, new Set(tabs.map((t) => t.key)));
    setTabs((prev) => [...prev, tab]);
    setSelectedKey(tab.key);
  };

  const restoreTab = (tab: SheetTab) => {
    setTabs((prev) => [...prev, tab]);
    setSelectedKey(tab.key);
  };

  const resetToDefault = () => {
    const defaults = resolveSheetLayout(undefined).tabs;
    setTabs(defaults);
    setSelectedKey(defaults[0]?.key);
    setConfirmingReset(false);
  };

  const save = () => {
    setSaveError(null);
    saveMutation.mutate(toSheetConfig(tabs), {
      onSuccess: (game) => {
        // Rebase on what the server stored, which is normalized (trimmed).
        const saved = resolveSheetLayout(game.character_sheet).tabs;
        setTabs(saved);
        setBaseline(savedForm(saved));
        showSuccess('Character sheet saved');
      },
      onError: (error) => setSaveError(saveErrorMessage(error)),
    });
  };

  return (
    <div className="space-y-6">
      {saveError && (
        <Alert variant="danger" dismissible onDismiss={() => setSaveError(null)}>
          {saveError}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Card variant="default" padding="sm">
          <CardHeader>
            <h2 className="text-lg font-semibold text-content-primary">Tabs</h2>
          </CardHeader>
          <CardBody>
            <SheetTabList
              tabs={tabs}
              selectedKey={selected?.key}
              tabsWithProblems={tabsWithProblems}
              cast={cast}
              lootTableCounts={lootTableCounts}
              lootTablesHref={`/games/${gameId}?tab=loot_tables`}
              onSelect={setSelectedKey}
              onMove={(index, direction) => setTabs((prev) => move(prev, index, direction))}
              onRemove={(key) => setTabs((prev) => prev.filter((tab) => tab.key !== key))}
              onAdd={addTab}
              onRestore={restoreTab}
            />
          </CardBody>
        </Card>

        <Card variant="default" padding="sm">
          {selected ? (
            <SheetTabDetail
              // Remounted per tab, so a half-filled add-field form does not
              // follow the GM to another tab.
              key={selected.key}
              tab={selected}
              problems={problems.filter((p) => p.tabKey === selected.key)}
              cast={cast}
              onChange={replaceTab}
            />
          ) : (
            <p className="text-sm text-content-secondary">
              This sheet has only Public Profile and Private Notes. Add a tab, or restore a built-in one.
            </p>
          )}
        </Card>
      </div>

      <div className="sticky bottom-0 z-10 py-3 surface-base border-t border-theme-default space-y-3">
        {confirmingReset && (
          <ConfirmRemoval
            message="Replace this draft with the default tabs and fields? Custom tabs and fields, and any renames, go once you save. Stored entries are kept, hidden."
            onRemove={resetToDefault}
            onKeep={() => setConfirmingReset(false)}
            confirmLabel="Reset"
            keepLabel="Cancel"
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmingReset(true)}>
            Reset to default
          </Button>
          <div className="flex items-center gap-3">
            {problems.length > 0 ? (
              <span className="text-sm text-semantic-danger" data-testid="sheet-editor-problems">
                Fix the problems marked above to save.
              </span>
            ) : isDirty ? (
              <span className="text-sm text-content-secondary">Unsaved changes</span>
            ) : null}
            <Button
              type="button"
              variant="primary"
              onClick={save}
              disabled={!isDirty || problems.length > 0}
              loading={saveMutation.isPending}
              data-testid="save-character-sheet"
            >
              Save changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
