import { Button } from '@/components/ui';

interface ReorderButtonsProps {
  /** Names the thing being moved, for screen readers: "Move Skills up". */
  name: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: -1 | 1) => void;
}

/** Up/down buttons for reordering a list. Buttons rather than drag, so it works on a phone and a keyboard. */
export function ReorderButtons({ name, canMoveUp, canMoveDown, onMove }: ReorderButtonsProps) {
  return (
    <div className="flex items-center">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="px-2"
        onClick={() => onMove(-1)}
        disabled={!canMoveUp}
        aria-label={`Move ${name} up`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="px-2"
        onClick={() => onMove(1)}
        disabled={!canMoveDown}
        aria-label={`Move ${name} down`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>
    </div>
  );
}
