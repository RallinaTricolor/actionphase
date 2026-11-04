import { useState } from 'react';
import { Badge, Button, Checkbox, Input, Modal, Radio, Select, Textarea } from '@/components/ui';
import { ConfirmModal } from '@/components/common/modals/ConfirmModal';
import type { GameBoardSettings, RewardItem, RewardLine, SheetOp } from '@/lib/gmBoard/types';
import type { SheetTab } from '@/types/characters';
import { SheetOpsEditor } from './SheetOpsEditor';

const TEXT_HELP = 'Shown in the reward block. {{entry}}, {{before}} and {{after}} fill in from the first sheet change.';

interface FieldsProps {
  value: { group: string; text: string; choose: boolean; ops: SheetOp[] };
  onChange: (patch: Partial<{ group: string; text: string; choose: boolean; ops: SheetOp[] }>) => void;
  groups: GameBoardSettings['rewardGroups'];
  layout: readonly SheetTab[];
  entryNames: (tabKey: string) => string[];
  allowBlankEntry?: boolean;
  idPrefix: string;
}

/** Section, text, Choose 1 and sheet changes: what a list item and a line share. */
function RewardFields({ value, onChange, groups, layout, entryNames, allowBlankEntry, idPrefix }: FieldsProps) {
  const known = groups.some((g) => g.key === value.group);
  return (
    <div className="space-y-3">
      <Select id={`${idPrefix}-section`} label="Section" value={value.group} onChange={(e) => onChange({ group: e.target.value })} data-testid={`${idPrefix}-group`}>
        {!known && <option value={value.group}>{value.group || '(none)'} (not in Game setup)</option>}
        {groups.map((g) => (
          <option key={g.key} value={g.key}>
            {g.label}
          </option>
        ))}
      </Select>
      <Textarea
        id={`${idPrefix}-text-box`}
        label="Text"
        helperText={TEXT_HELP}
        rows={5}
        value={value.text}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="**Fall Guy:** Cause someone to fall into the abyss"
        data-testid={`${idPrefix}-text`}
      />
      <Checkbox
        id={`${idPrefix}-choose-box`}
        label="Player chooses (“Choose 1”)"
        helperText="The text goes in the block and nothing goes on the sheet. Once results are out and they pick, update their sheet yourself."
        checked={value.choose}
        onChange={(e) => onChange({ choose: e.target.checked })}
        data-testid={`${idPrefix}-choose`}
      />
      {!value.choose && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-content-primary">Sheet changes</h4>
          <SheetOpsEditor ops={value.ops} onChange={(ops) => onChange({ ops })} layout={layout} entryNames={entryNames} allowBlankEntry={allowBlankEntry} idPrefix={idPrefix} />
        </div>
      )}
    </div>
  );
}

interface LineEditorProps {
  line: RewardLine | null;
  onClose: () => void;
  characterName: string;
  /** The list item it was given from, if it still exists. */
  item?: RewardItem;
  sceneName?: string;
  groups: GameBoardSettings['rewardGroups'];
  layout: readonly SheetTab[];
  entryNames: (tabKey: string) => string[];
  onChange: (line: RewardLine) => void;
  onRemove: () => void;
  /** Saves a one-off as a list item, so others can get it. */
  onAddToList?: () => void;
  locked?: boolean;
}

/** One character's reward line: their own copy, so edits here change only theirs. */
export function RewardLineEditor({ line, onClose, characterName, item, sceneName, groups, layout, entryNames, onChange, onRemove, onAddToList, locked = false }: LineEditorProps) {
  return (
    <Modal isOpen={line !== null} onClose={onClose} title={`${characterName}: reward line`} size="lg">
      {line && (
        <div className="space-y-4" data-testid="reward-line-editor">
          {item && (
            <p className="text-sm text-content-secondary">
              Given from the {item.scope === 'game' ? 'every-phase' : 'this phase’s'} list: <strong>{item.name}</strong>. Edits here change only {characterName}’s copy.
            </p>
          )}
          {sceneName && <p className="text-sm text-content-secondary">From the scene {sceneName}.</p>}
          {line.quote && (
            <blockquote className="rounded surface-sunken px-3 py-2 text-sm italic text-content-secondary">“{line.quote}”</blockquote>
          )}
          {locked ? (
            <p className="text-sm text-content-secondary">This result is published, so its rewards can’t change.</p>
          ) : (
            <RewardFields value={line} onChange={(patch) => onChange({ ...line, ...patch })} groups={groups} layout={layout} entryNames={entryNames} idPrefix="line" />
          )}
          <div className="flex flex-wrap justify-between gap-2 border-t border-theme-default pt-3">
            {!item && onAddToList && !locked ? (
              <Button type="button" size="sm" variant="ghost" onClick={onAddToList}>
                Add to this phase’s list for others
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              {!locked && (
                <Button type="button" size="sm" variant="danger" onClick={onRemove}>
                  Remove line
                </Button>
              )}
              <Button type="button" size="sm" variant="primary" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

interface ItemEditorProps {
  item: RewardItem | null;
  onClose: () => void;
  /** The phase "this phase" means, for the scope choice and the given-to chips. */
  phaseTitle?: string;
  groups: GameBoardSettings['rewardGroups'];
  layout: readonly SheetTab[];
  entryNames: (tabKey: string) => string[];
  onChange: (item: RewardItem) => void;
  /** Moves it to the other list. */
  onMove?: (scope: RewardItem['scope']) => void;
  onDelete: () => void;
  /** Given-to chips for the phase in view, when there is one. */
  givenTo?: { id: number; name: string; given: boolean }[];
  onToggleGiven?: (characterId: number) => void;
}

/** A reward in a list: defined once, given to many. */
export function RewardItemEditor({ item, onClose, phaseTitle, groups, layout, entryNames, onChange, onMove, onDelete, givenTo, onToggleGiven }: ItemEditorProps) {
  const [confirming, setConfirming] = useState(false);
  return (
    <Modal isOpen={item !== null} onClose={onClose} title={item?.name || 'New reward'} size="lg">
      {item && (
        <div className="space-y-4" data-testid="reward-item-editor">
          <Input id="reward-item-name" label="Name" value={item.name} onChange={(e) => onChange({ ...item, name: e.target.value })} data-testid="item-name" />
          {onMove && (
            <fieldset className="space-y-1">
              <legend className="text-sm font-medium text-content-primary">Applies to</legend>
              <div className="flex flex-wrap gap-4">
                <Radio name="reward-scope" value="game" label="Every phase" checked={item.scope === 'game'} onChange={() => onMove('game')} />
                {phaseTitle && <Radio name="reward-scope" value="phase" label={`${phaseTitle} only`} checked={item.scope === 'phase'} onChange={() => onMove('phase')} />}
              </div>
            </fieldset>
          )}
          <RewardFields
            value={item}
            onChange={(patch) => onChange({ ...item, ...patch })}
            groups={groups}
            layout={layout}
            entryNames={entryNames}
            allowBlankEntry
            idPrefix="item"
          />
          {givenTo && onToggleGiven && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-content-primary">Given to in {phaseTitle}</h4>
              <div className="flex flex-wrap gap-2">
                {givenTo.map((p) => (
                  <Button key={p.id} type="button" size="sm" variant={p.given ? 'primary' : 'outline'} aria-pressed={p.given} onClick={() => onToggleGiven(p.id)}>
                    {p.name}
                  </Button>
                ))}
              </div>
              <p className="mt-1 text-xs text-content-tertiary">Each person gets a copy. Changing this later flags their copies so you can update them.</p>
            </div>
          )}
          <div className="flex justify-between gap-2 border-t border-theme-default pt-3">
            <Button type="button" size="sm" variant="danger" onClick={() => setConfirming(true)}>
              Delete from list
            </Button>
            <Button type="button" size="sm" variant="primary" onClick={onClose}>
              Done
            </Button>
          </div>
          <ConfirmModal
            isOpen={confirming}
            onClose={() => setConfirming(false)}
            onConfirm={() => {
              setConfirming(false);
              onDelete();
            }}
            title="Delete from the list"
            message={`This removes ${item.name || 'this reward'} from the list. Copies already given stay.`}
            confirmText="Delete"
            variant="danger"
          />
        </div>
      )}
    </Modal>
  );
}

/** A reward's section label, for chips and rows. */
export function GroupBadge({ groups, group }: { groups: GameBoardSettings['rewardGroups']; group: string }) {
  return (
    <Badge size="sm" variant="neutral">
      {groups.find((g) => g.key === group)?.label ?? group}
    </Badge>
  );
}
