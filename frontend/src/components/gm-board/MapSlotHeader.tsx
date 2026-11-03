import { Badge, Button, Input } from '@/components/ui';
import { useBoundText } from '@/hooks/useBoundText';
import type { Chunk } from '@/lib/gmBoard/types';

interface MapSlotHeaderProps {
  slot: Chunk;
  index: number;
  /** Open flags in this slot. */
  todo: number;
  /** It has cards (so ✓ when nothing is left to do). */
  hasCards: boolean;
  /** No cards or scenes, and not the only slot: it can be removed. */
  removable: boolean;
  dimmed: boolean;
  onRename: (name: string) => void;
  onInsertBefore: () => void;
  onRemove: () => void;
  onResolve: () => void;
}

/** A time slot's column head: its number and name (editable), "+ before", remove, and what's left to resolve. */
export function MapSlotHeader({ slot, index, todo, hasCards, removable, dimmed, onRename, onInsertBefore, onRemove, onResolve }: MapSlotHeaderProps) {
  const name = useBoundText(slot.name);
  return (
    <div className={`space-y-1 p-2 ${dimmed ? 'opacity-50' : ''}`} data-testid={`slot-head-${slot.id}`}>
      <div className="flex items-center gap-1 text-xs text-content-tertiary">
        <span>{index + 1}</span>
        <Button type="button" variant="ghost" size="sm" className="!px-1 !py-0 text-xs" onClick={onInsertBefore} aria-label={`Insert a time slot before ${slot.name}`}>
          + before
        </Button>
        {removable && (
          <Button type="button" variant="ghost" size="sm" className="!px-1 !py-0 text-xs" onClick={onRemove} aria-label={`Remove the empty slot ${slot.name}`}>
            ✕
          </Button>
        )}
        <span className="flex-1" />
        {todo > 0 ? (
          <Button type="button" variant="ghost" size="sm" className="!px-1 !py-0" onClick={onResolve} title={`Resolve ${slot.name}`}>
            <Badge variant="warning" size="sm">
              {todo} to do
            </Badge>
          </Button>
        ) : (
          hasCards && (
            <Badge variant="success" size="sm" aria-label="Nothing left to do">
              ✓
            </Badge>
          )
        )}
      </div>
      <Input
        id={`slot-${slot.id}-name`}
        aria-label={`Name of time slot ${index + 1}`}
        inputSize="sm"
        value={name.text}
        {...name.bind}
        onChange={(e) => {
          name.setText(e.target.value);
          onRename(e.target.value);
        }}
      />
    </div>
  );
}
