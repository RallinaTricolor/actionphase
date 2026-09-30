import { useEffect, useState, type ChangeEvent } from 'react';
import { Alert, Button, HelpTooltip, Input, Select } from '@/components/ui';
import type { LootTable, LootTableContent } from '@/types/games';
import { AddEntryModal } from './AddEntryModal';
import { createEntry, type EntryEdit } from '@/lib/sheetEntries';
import { lootCsvHelp, lootTableToCsv, parseLootTableCsv } from '@/lib/lootTableCsv';
import { useSheetLayout, DEFAULT_SHEET_LAYOUT } from '@/hooks/useSheetLayout';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useOptionalGameContext } from '@/contexts/GameContext';
import { DownloadIcon, TrashIcon, UploadIcon } from 'lucide-react';

export interface EditLootTable {
  id?: number;
  name: string;
  /** Key of the sheet tab the table rolls into. */
  targetTab: string;
  items?: LootTableContent[];
  itemsChanged: boolean;
}

interface LootTableFormProps {
  onClose: () => void;
  onSubmit: (data: EditLootTable) => void;
  isSubmitting: boolean;
  lootTable?: LootTable;
}

export function LootTableForm({ onClose, onSubmit, isSubmitting, lootTable }: LootTableFormProps) {
  const gameContext = useOptionalGameContext();
  const { tabs } = useSheetLayout(gameContext?.game);

  const { data: lootTableContents } = useQuery({
    queryKey: ['lootTableContents', lootTable?.id],
    queryFn: () => apiClient.games.getLootTableContents(gameContext!.gameId, lootTable?.id ?? 0).then(res => res.data),
    enabled: !!lootTable?.id
  });

  useEffect(() => {
    setFormData(p => ({
      ...p,
      items: lootTableContents || undefined,
      itemsChanged: false
    }));
  }, [lootTableContents]);

  const [formData, setFormData] = useState<EditLootTable>({
    id: lootTable?.id,
    name: lootTable?.name || '',
    // A new table defaults to Inventory, where every table rolled before
    // targets existed, or else the sheet's first tab.
    targetTab: lootTable?.target_tab ?? (tabs.some((tab) => tab.key === 'inventory') ? 'inventory' : tabs[0]?.key ?? ''),
    items:  undefined,
    itemsChanged: false
  });

  // The table's entries use its target tab's schema. A target the sheet no
  // longer has (a layout saved before targets existed) falls back to the
  // built-in's default fields, or to name only.
  const targetTab = tabs.find((tab) => tab.key === formData.targetTab);
  const targetFields =
    targetTab?.fields ?? DEFAULT_SHEET_LAYOUT.find((tab) => tab.key === formData.targetTab)?.fields ?? [];
  const [isAddingContent, setIsAddingContent] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // A table with no name is unidentifiable in the picker, so that stays blocked.
  //
  // Empty tables are allowed on purpose: GMs build a table before they have
  // decided its contents, and importing a CSV into a saved table is a normal
  // flow. Rolling on an empty table is already handled in depth — the API
  // returns 400 and useLootRoll surfaces that as an error toast — so
  // blocking creation here only got in the way of authoring.
  const validationError = !formData.name.trim()
    ? 'Give the loot table a name.'
    : !formData.targetTab
      ? 'Add a tab to the character sheet for this table to roll into.'
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError) return;
    onSubmit(formData);
  };

  
  const addItem = (edit: EntryEdit) => {
    // An entry minus its id: every roll or pick gets a fresh one.
    const { id: _id, ...data } = createEntry('', edit);
    const newContent : LootTableContent = {
      id: 0,
      name: data.name,
      data: JSON.stringify(data),
    }
    setFormData(p => ({...p, items: [...(p.items || []), newContent], itemsChanged: true}));
    setIsAddingContent(false);
  };

  const importLootTable = (event: ChangeEvent<HTMLInputElement>): void => {
    if (!event.target.files?.length) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!e.target?.result) {
        setImportError('That file could not be read.');
        return;
      }
      const result = parseLootTableCsv(e.target.result as string, targetFields);
      if ('error' in result) {
        setImportError(result.error);
        return;
      }
      setImportError(null);
      setFormData(p => ({
        ...p,
        items: result.items,
        itemsChanged: true
      }));
    }
    reader.onerror = () => setImportError('That file could not be read.');
    reader.readAsText(event.target.files[0]);
    // Reset so picking the same file again after fixing it re-triggers onChange.
    event.target.value = '';
  }


  const exportLootTable = (_: React.MouseEvent<HTMLButtonElement>): void => {
    // btoa throws on any character outside Latin-1, which item names and
    // descriptions routinely contain (accents, em dashes, curly quotes). A Blob
    // URL carries UTF-8 directly and needs no base64 step.
    const url = URL.createObjectURL(
      new Blob([lootTableToCsv(formData.items || [], targetFields)], { type: 'text/csv;charset=utf-8;' })
    );
    const el = document.createElement('a');
    el.setAttribute('href', url);
    el.setAttribute('download', `${formData.name.toLowerCase().replaceAll(' ', '_') || 'loot_table'}.csv`);
    el.style.display = 'none';

    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);
    URL.revokeObjectURL(url);
  };

  const hasItems = (formData.items?.length ?? 0) > 0;


  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 mt-6">
          {/* Sits directly beside Import/Export rather than across the row from
              them, so the label and tooltip read as describing those two buttons. */}
          <span className="flex items-center gap-1 text-sm text-content-secondary">
            Bulk edit with CSV
            {/* Right-anchored: the icon now sits near the modal's right edge, where
                the default left anchoring overflows it. */}
            <HelpTooltip text={lootCsvHelp(targetFields)} align="right" />
          </span>

          {/* Labelled, not icon-only: a bare up-arrow gives no hint that this
              screen supports CSV at all, which is how GMs missed the feature. */}
          <label
            className={`inline-flex h-9 items-center gap-2 px-3 rounded-md text-sm text-content-secondary transition-colors ${
              isSubmitting
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer hover:text-content-primary hover:bg-interactive-primary-subtle'
            }`}
            htmlFor='import-loot-table'>
            <UploadIcon className="h-5 w-5" />
            Import
            <input disabled={isSubmitting} type="file" id="import-loot-table" accept=".csv,text/csv" onChange={importLootTable} className="hidden" />
          </label>
          <button
            type="button"
            // Exporting an empty table produces a file with no rows, which then
            // fails to reimport — nothing useful to hand the GM.
            disabled={isSubmitting || !hasItems}
            title={hasItems ? undefined : 'Add at least one item to export'}
            aria-label="Export loot table as CSV"
            onClick={exportLootTable}
            className="inline-flex h-9 items-center gap-2 px-3 rounded-md text-sm text-content-secondary hover:text-content-primary hover:bg-interactive-primary-subtle transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <DownloadIcon className="h-5 w-5" />
            Export
          </button>
        </div>

        {importError && (
          <Alert variant="danger" className="mt-3" title="Import failed">
            {importError}
          </Alert>
        )}
        <div className="space-y-4">

            <div>
              <Input
                id="loot-table-name"
                label="Table Name"
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  name: e.target.value
                }))}
                placeholder="e.g., 'Normal Items'"
                helperText="Give this loot table a custom name"
              />
            </div>
            <div>
              {/* Locked while the table has items: they were written for this
                  tab's fields, and the server refuses to reinterpret them. */}
              <Select
                id="loot-table-target-tab"
                label="Rolls into"
                value={formData.targetTab}
                disabled={isSubmitting || hasItems}
                onChange={(e) => setFormData((prev) => ({ ...prev, targetTab: e.target.value }))}
                helperText={
                  hasItems
                    ? "Remove this table's items to choose a different tab: they were written for this tab's fields."
                    : 'The character sheet tab a pick or roll from this table adds to.'
                }
              >
                {!targetTab && formData.targetTab && (
                  <option value={formData.targetTab}>Removed tab</option>
                )}
                {tabs.map((tab) => (
                  <option key={tab.key} value={tab.key}>{tab.label}</option>
                ))}
              </Select>
              {tabs.length === 0 && (
                <Alert variant="warning" className="mt-2">
                  This game's character sheet has no tabs for a loot table to roll into.
                </Alert>
              )}
            </div>
            <div >
              {formData.items && formData.items.length > 0 
                ? (formData.items.map((item, index) => (
                  <div className="md:flex items-center" key={index}>
                    <div className="mb-1">
                      <button
                        type="button"
                        disabled={isSubmitting}
                        aria-label={`Remove ${item.name}`}
                        // Filter positionally off the updater's `p`, not the `formData`
                        // captured at render. The previous version closed over the render
                        // snapshot, so two removals before the next render both filtered
                        // the same stale array and the second undid the first.
                        onClick={_ => setFormData(p => ({...p, items: p.items?.filter((_unused, i) => i !== index), itemsChanged: true }))}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-content-secondary hover:text-content-primary hover:bg-interactive-primary-subtle transition-colors"
                      >
                        <TrashIcon  className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="block text-sm font-medium text-content-primary mb-2">{index + 1} - {item.name}</div>
                  </div>))) 
                : (<div></div>)}
            </div>

              <div>
                <Button
                  variant="primary"
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsAddingContent(true)}
                >
                  Add Loot Table Content
                </Button>
            </div>
            

        </div>


        {validationError && (
          <p className="mt-4 text-sm text-content-secondary" role="status">
            {validationError}
          </p>
        )}

        <div className="flex justify-end space-x-3 mt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || validationError !== null}
            data-faro-user-action-name="create-loot-table"
          >
            {isSubmitting 
              ? lootTable ? 'Updating...' : 'Creating...' 
              : lootTable ? 'Update Loot Table' : 'Create Loot Table'}
          </Button>
        </div>
      </form>

      {/*
        Add Loot Table Content Modal. loot_table_random is intentionally left off:
        this modal defines the contents of a loot table, so sourcing an item at random
        *from* a loot table makes no sense here, and no onAddRandom is passed.
      */}
      {isAddingContent && (
        <AddEntryModal
          fields={targetFields}
          onAdd={addItem}
          onCancel={() => {setIsAddingContent(false)}}
          lootModes={['manual', 'loot_table']}
          // "Pick from a table" offers only tables rolling into the same tab,
          // whose entries share this schema.
          lootTargetTab={formData.targetTab}
        />
      )}
    </div>
  );
}
