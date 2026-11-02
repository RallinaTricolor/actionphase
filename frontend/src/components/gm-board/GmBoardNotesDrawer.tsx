import { Drawer, Textarea } from '@/components/ui';
import { useBoundText } from '@/hooks/useBoundText';

interface GmBoardNotesDrawerProps {
  open: boolean;
  onClose: () => void;
  /** The saved notes (another GM's edits arrive here by polling). */
  notes: string;
  onChange: (text: string) => void;
  readOnly?: boolean;
}

/** The GM's scratch notes for this phase. The box keeps its own text while focused (see `useBoundText`). */
export function GmBoardNotesDrawer({ open, onClose, notes, onChange, readOnly = false }: GmBoardNotesDrawerProps) {
  const { text, setText, bind } = useBoundText(notes);

  return (
    <Drawer open={open} onClose={onClose} title="Notes" side="right">
      <Textarea
        id="gm-board-notes"
        label="Notes for this phase"
        helperText="Only you and your co-GMs can see these, unless you share the board."
        rows={16}
        value={text}
        readOnly={readOnly}
        {...bind}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value);
        }}
        data-testid="gm-board-notes"
      />
    </Drawer>
  );
}
