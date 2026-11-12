import { Drawer, Textarea } from '@/components/ui';
import { useBoundText } from '@/hooks/useBoundText';

interface GmBoardNotesDrawerProps {
  open: boolean;
  onClose: () => void;
  phaseTitle: string;
  /** This phase's saved notes (another GM's edits arrive here by polling). */
  notes: string;
  onChange: (text: string) => void;
  /** The game's notes, for every phase (a game setting). */
  gameNotes: string;
  onGameChange: (text: string) => void;
  readOnly?: boolean;
}

/**
 * The GM's scratch notes: the game's, which every phase's board shows, and
 * this phase's. Each box keeps its own text while focused (see `useBoundText`).
 */
export function GmBoardNotesDrawer({ open, onClose, phaseTitle, notes, onChange, gameNotes, onGameChange, readOnly = false }: GmBoardNotesDrawerProps) {
  return (
    <Drawer open={open} onClose={onClose} title="Notes" side="right">
      <div className="p-4 space-y-6">
        <NotesBox id="gm-board-game-notes" label="Notes for every phase" notes={gameNotes} onChange={onGameChange} readOnly={readOnly} rows={8} />
        <NotesBox id="gm-board-notes" label={`Notes for ${phaseTitle}`} notes={notes} onChange={onChange} readOnly={readOnly} rows={14} />
        {!readOnly && <p className="text-sm text-content-tertiary">Only you and your co-GMs can see these, unless you share the board.</p>}
      </div>
    </Drawer>
  );
}

interface NotesBoxProps {
  id: string;
  label: string;
  notes: string;
  onChange: (text: string) => void;
  readOnly: boolean;
  rows: number;
}

function NotesBox({ id, label, notes, onChange, readOnly, rows }: NotesBoxProps) {
  const { text, setText, bind } = useBoundText(notes);

  if (readOnly) {
    return (
      <div data-testid={id}>
        <h3 className="text-sm font-medium text-content-primary mb-2">{label}</h3>
        {notes.trim() ? <p className="whitespace-pre-wrap text-content-primary">{notes}</p> : <p className="text-content-tertiary">No notes.</p>}
      </div>
    );
  }
  return (
    <Textarea
      id={id}
      label={label}
      rows={rows}
      value={text}
      {...bind}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value);
      }}
      data-testid={id}
    />
  );
}
