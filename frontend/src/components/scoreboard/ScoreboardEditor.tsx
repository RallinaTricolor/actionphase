import { useMemo, useState } from 'react';
import { Alert, Button, Select, Spinner } from '@/components/ui';
import { ConfirmDiscardDraft } from '@/components/common/modals/ConfirmDiscardDraft';
import { UnsavedChangesGuard } from '@/components/common/UnsavedChangesGuard';
import { useToast } from '@/contexts/ToastContext';
import { useScoreboardConfig, useScoreboardEntryNames, useUpdateScoreboardConfig } from '@/hooks/useScoreboard';
import { useSheetLayout } from '@/hooks/useSheetLayout';
import { extractApiErrorMessage } from '@/lib/errors';
import { isPublicArchive } from '@/lib/gamePermissions';
import {
  duplicateScoreboardColumnIds,
  findScoreboardSourceField,
  MAX_SCOREBOARD_COLUMNS,
  newScoreboardColumn,
  removeScoreboardColumn,
  SCOREBOARD_SORT_BY_NAME,
  scoreboardColumnsComplete,
  scoreboardSourceTabs,
  scoreboardTopCountError,
  toScoreboardConfig,
} from '@/lib/scoreboardEditing';
import type { CharacterSheetConfig } from '@/types/characters';
import type { ScoreboardColumn, ScoreboardConfig, ScoreboardEntryNames, ScoreboardVisibility } from '@/types/scoreboard';
import { ScoreboardColumnEditor } from './ScoreboardColumnEditor';
import { ScoreboardColumnPicker } from './ScoreboardColumnPicker';
import { ScoreboardEditorSection } from './ScoreboardEditorSection';
import { ScoreboardPreview } from './ScoreboardPreview';
import { ScoreboardSortFields } from './ScoreboardSortFields';
import { ScoreboardTopCountField } from './ScoreboardTopCountField';

interface ScoreboardEditorProps {
  gameId: number;
  game: { state?: string; character_sheet?: CharacterSheetConfig };
  /** Leaves the editor, after a save or a cancel. */
  onClose: () => void;
}

interface ScoreboardEditorFormProps extends ScoreboardEditorProps {
  config: ScoreboardConfig;
  entryNames: ScoreboardEntryNames | undefined;
}

const serialized = (draft: ScoreboardConfig) => JSON.stringify(toScoreboardConfig(draft));

function ScoreboardEditorForm({ gameId, game, config, entryNames, onClose }: ScoreboardEditorFormProps) {
  const { showSuccess } = useToast();
  const saveMutation = useUpdateScoreboardConfig(gameId);
  const layout = useSheetLayout(game);
  const tabs = useMemo(() => scoreboardSourceTabs(layout), [layout]);
  const namesByTab = useMemo(
    () => new Map((entryNames?.tabs ?? []).map((tab) => [tab.tab_key, tab.entry_names ?? []])),
    [entryNames],
  );

  const [draft, setDraft] = useState(config);
  const [baseline] = useState(() => serialized(config));
  const [previewing, setPreviewing] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Remounts the add-column picker, so it empties after each add.
  const [pickerRound, setPickerRound] = useState(0);

  const columns = draft.columns ?? [];
  const sort = draft.sort ?? [];
  const isDirty = serialized(draft) !== baseline;
  const isArchived = isPublicArchive(game.state);
  const hasBrokenColumn = columns.some((column) => !findScoreboardSourceField(tabs, column));
  const duplicateIds = duplicateScoreboardColumnIds(columns);
  const hasTopCountError = scoreboardTopCountError(draft.top_count) !== undefined;
  // Headings and ranges still being filled in: the server would refuse them.
  const isIncomplete = !scoreboardColumnsComplete(columns);

  const setColumns = (next: ScoreboardColumn[]) => setDraft((current) => ({ ...current, columns: next }));

  const moveColumn = (index: number, direction: -1 | 1) => {
    const next = [...columns];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setColumns(next);
  };

  const save = () => {
    setSaveError(null);
    saveMutation.mutate(toScoreboardConfig(draft), {
      onSuccess: () => {
        showSuccess('Scoreboard saved');
        onClose();
      },
      onError: (error) => setSaveError(extractApiErrorMessage(error) ?? 'Failed to save the scoreboard. Please try again.'),
    });
  };

  return (
    <section aria-labelledby="scoreboard-editor-heading" className="space-y-6" data-testid="scoreboard-editor">
      <UnsavedChangesGuard
        when={isDirty}
        noun="changes"
        message="Your scoreboard changes aren't saved. If you leave, they will be lost."
      />
      <ConfirmDiscardDraft
        isOpen={confirmingCancel}
        onKeepEditing={() => setConfirmingCancel(false)}
        onDiscard={onClose}
        noun="changes"
        message="Your scoreboard changes aren't saved. If you discard them, they will be lost."
      />

      <h2 id="scoreboard-editor-heading" className="text-2xl font-bold text-content-primary">
        {previewing ? 'Preview as player' : 'Edit scoreboard'}
      </h2>

      {saveError && (
        <Alert variant="danger" dismissible onDismiss={() => setSaveError(null)}>{saveError}</Alert>
      )}

      {previewing ? (
        <ScoreboardPreview gameId={gameId} config={toScoreboardConfig(draft)} isArchived={isArchived} />
      ) : (
        <div className="space-y-3 rounded-lg surface-sunken p-2 sm:space-y-4 sm:p-4">
          <ScoreboardEditorSection title="Visibility">
            <Select
              label="Who can see the board"
              selectSize="sm"
              value={draft.visibility ?? 'staff'}
              onChange={(e) => setDraft({ ...draft, visibility: e.target.value as ScoreboardVisibility })}
              helperText={isArchived
                ? 'Once a game reaches its epilogue, everyone can see the whole board.'
                : 'Everyone means anyone logged in, as with the Common Room. Hidden columns stay hidden from players.'}
            >
              <option value="staff">GM and audience only</option>
              <option value="public">Everyone</option>
            </Select>
          </ScoreboardEditorSection>

          <ScoreboardEditorSection title="Columns" description="Each column reads one entry from every character's sheet.">
            <div className="space-y-4">
              {columns.map((column, index) => (
                <ScoreboardColumnEditor
                  key={column.id}
                  column={column}
                  tabs={tabs}
                  entryNames={namesByTab}
                  canMoveUp={index > 0}
                  canMoveDown={index < columns.length - 1}
                  isDuplicate={duplicateIds.has(column.id)}
                  isSortKey={sort.some((key) => key.key === column.id)}
                  onChange={(next) => setColumns(columns.map((c) => (c.id === next.id ? next : c)))}
                  onMove={(direction) => moveColumn(index, direction)}
                  onRemove={() => setDraft(removeScoreboardColumn(draft, column.id))}
                />
              ))}
              {columns.length < MAX_SCOREBOARD_COLUMNS ? (
                <div className="space-y-3 rounded-lg border-2 border-dashed border-theme-strong p-3 sm:p-4" data-testid="scoreboard-add-column">
                  <h4 className="font-medium text-content-primary">Add a column</h4>
                  <ScoreboardColumnPicker
                    key={pickerRound}
                    tabs={tabs}
                    entryNames={namesByTab}
                    submitLabel="Add column"
                    onPick={(source) => {
                      setColumns([...columns, newScoreboardColumn(source, new Set(columns.map(({ id }) => id)))]);
                      setPickerRound((round) => round + 1);
                    }}
                  />
                </div>
              ) : (
                <p className="text-sm text-content-secondary">A board can have {MAX_SCOREBOARD_COLUMNS} columns.</p>
              )}
            </div>
          </ScoreboardEditorSection>

          <ScoreboardEditorSection title="Order">
            <div className="space-y-4">
              <ScoreboardSortFields
                columns={columns}
                sort={sort}
                onChange={(next) => setDraft({ ...draft, sort: next })}
              />
              <div className="border-t border-theme-default pt-4">
                <ScoreboardTopCountField
                  value={draft.top_count}
                  sortedByName={(sort[0]?.key ?? SCOREBOARD_SORT_BY_NAME) === SCOREBOARD_SORT_BY_NAME}
                  onChange={(topCount) => {
                    const { top_count: _previous, ...rest } = draft;
                    setDraft(topCount === undefined ? rest : { ...rest, top_count: topCount });
                  }}
                />
              </div>
            </div>
          </ScoreboardEditorSection>
        </div>
      )}

      {/* One row on a phone: small buttons, and the unsaved note only where it fits
          (a disabled Save already says there is nothing to save). */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 border-t border-theme-strong surface-base px-3 py-2 sm:px-4">
        <Button type="button" variant="secondary" size="sm" onClick={() => setPreviewing(!previewing)} data-testid="scoreboard-preview-toggle">
          {previewing ? 'Back to editing' : 'Preview as player'}
        </Button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {hasBrokenColumn || isIncomplete ? (
            <span className="text-sm text-semantic-danger" data-testid="scoreboard-editor-blocked">
              {hasBrokenColumn ? 'Fix or remove the columns marked above to save.' : 'Finish the columns marked above to save.'}
            </span>
          ) : isDirty ? (
            <span className="hidden text-sm text-content-secondary sm:inline">Unsaved changes</span>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => (isDirty ? setConfirmingCancel(true) : onClose())}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={save}
            disabled={!isDirty || hasBrokenColumn || hasTopCountError || isIncomplete}
            loading={saveMutation.isPending}
            data-testid="save-scoreboard"
          >
            Save changes
          </Button>
        </div>
      </div>
    </section>
  );
}

/**
 * The GM's setup for the board. Everything is a draft until Save, which replaces
 * the whole setup. Loading the entry names can fail without harm: the GM can
 * still type them.
 */
export function ScoreboardEditor({ gameId, game, onClose }: ScoreboardEditorProps) {
  const { data: config, isLoading, isError, refetch } = useScoreboardConfig(gameId);
  const { data: entryNames, isLoading: isLoadingNames } = useScoreboardEntryNames(gameId);

  if (isLoading || isLoadingNames) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" label="Loading scoreboard setup" />
      </div>
    );
  }

  if (isError || !config) {
    return (
      <Alert variant="danger" title="The scoreboard setup didn't load">
        <div className="mt-2 flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => void refetch()}>Try again</Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Back to the board</Button>
        </div>
      </Alert>
    );
  }

  return <ScoreboardEditorForm gameId={gameId} game={game} config={config} entryNames={entryNames} onClose={onClose} />;
}
