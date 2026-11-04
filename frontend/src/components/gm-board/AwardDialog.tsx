import { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { needsEntry } from '@/lib/gmBoard/rewards';
import { defaultGroup } from '@/lib/gmBoard/rewardState';
import { truncate } from '@/lib/gmBoard/text';
import type { RewardItem } from '@/lib/gmBoard/types';
import { useBoardRewards } from './boardRewards';
import { RewardLineEditor } from './RewardEditors';

interface AwardDialogProps {
  /** The passage the reward is for; null when closed. */
  quote: string | null;
  characterId: number;
  name: string;
  onClose: () => void;
}

/**
 * + Award from Read: give a reward from the lists, or write a new line,
 * keeping the selected passage as the reason it was given.
 */
export function AwardDialog({ quote, characterId, name, onClose }: AwardDialogProps) {
  const rewards = useBoardRewards();
  const { showToast } = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const state = rewards.stateFor(characterId);
  const given = new Set(state.lines.map((l) => l.itemId).filter(Boolean));
  const line = state.lines.find((l) => l.id === editing) ?? null;

  const give = (item: RewardItem) => {
    const id = rewards.giveItem(characterId, item, { quote: quote ?? undefined });
    if (needsEntry(item.ops)) setEditing(id);
    else {
      showToast(`${item.name || 'Reward'} given to ${name}.`, 'success', { action: { label: 'Undo', onClick: () => rewards.removeLine(characterId, id) } });
      onClose();
    }
  };

  return (
    <>
      <Modal isOpen={quote !== null && editing === null} onClose={onClose} title={`Award ${name}`} size="lg">
        {quote !== null && (
          <div className="space-y-4" data-testid="award-dialog">
            <blockquote className="rounded surface-sunken px-3 py-2 text-sm italic text-content-secondary">“{truncate(quote, 400)}”</blockquote>
            {state.locked ? (
              <p className="text-sm text-content-secondary">{name}’s result is published, so their rewards can’t change.</p>
            ) : (
              <>
                {rewards.items.length ? (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-content-primary">From the lists</h4>
                    <div className="flex flex-wrap gap-2">
                      {rewards.items.map((item) => (
                        <Button
                          key={item.id}
                          type="button"
                          size="sm"
                          variant={given.has(item.id) ? 'primary' : 'outline'}
                          title={truncate(item.text, 200)}
                          onClick={() => give(item)}
                          data-testid={`award-${item.id}`}
                        >
                          {item.name || 'Unnamed'}
                        </Button>
                      ))}
                    </div>
                    {given.size > 0 && <p className="text-xs text-content-tertiary">Highlighted ones {name} already has; giving one again adds another copy.</p>}
                  </div>
                ) : (
                  <p className="text-sm text-content-secondary">No reward lists yet. Add them on Game setup, or write a line here.</p>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setEditing(rewards.addLine(characterId, { group: defaultGroup(rewards.groups), text: '', ops: [], choose: false, quote: quote ?? undefined }))}
                  data-testid="award-new-line"
                >
                  + New line with this quote
                </Button>
              </>
            )}
          </div>
        )}
      </Modal>
      <RewardLineEditor
        line={line}
        onClose={() => {
          setEditing(null);
          onClose();
        }}
        characterName={name}
        item={line?.itemId ? rewards.items.find((i) => i.id === line.itemId) : undefined}
        groups={rewards.groups}
        layout={rewards.layout}
        entryNames={(tab) => (state.sheet.before[tab] ?? []).map((e) => e.name)}
        onChange={(next) => rewards.updateLine(characterId, next.id, () => next)}
        onRemove={() => {
          if (line) rewards.removeLine(characterId, line.id);
          setEditing(null);
          onClose();
        }}
      />
    </>
  );
}
