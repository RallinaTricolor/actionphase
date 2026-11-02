import { useEffect, useState } from 'react';
import { Drawer, Textarea } from '@/components/ui';

interface GmBoardNotesDrawerProps {
  open: boolean;
  onClose: () => void;
  /** The saved notes (another GM's edits arrive here by polling). */
  notes: string;
  onChange: (text: string) => void;
  readOnly?: boolean;
}

/**
 * The GM's scratch notes for this phase. The text box keeps its own state:
 * the board's cache tells its readers about a change a tick later, which is
 * too late for a controlled text box (typing would lose characters and move
 * the cursor). Notes from elsewhere replace the text only while the box isn't
 * focused.
 */
export function GmBoardNotesDrawer({ open, onClose, notes, onChange, readOnly = false }: GmBoardNotesDrawerProps) {
  const [text, setText] = useState(notes);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(notes);
  }, [notes, focused]);

  return (
    <Drawer open={open} onClose={onClose} title="Notes" side="right">
      <Textarea
        id="gm-board-notes"
        label="Notes for this phase"
        helperText="Only you and your co-GMs can see these, unless you share the board."
        rows={16}
        value={text}
        readOnly={readOnly}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value);
        }}
        data-testid="gm-board-notes"
      />
    </Drawer>
  );
}
