import { CommentEditor } from '@/components/messages/CommentEditor';
import { MarkdownPreview } from '@/components/common/markdown/MarkdownPreview';
import { useBoundText } from '@/hooks/useBoundText';

interface GmBoardNotesProps {
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
 * The board's Notes tab: this phase's notes and the game's (which every
 * phase's board shows), side by side on a wide screen, in the editor the
 * rest of the site writes markdown in. Each box keeps its own text while
 * focused (see `useBoundText`).
 */
export function GmBoardNotes({ phaseTitle, notes, onChange, gameNotes, onGameChange, readOnly = false }: GmBoardNotesProps) {
  return (
    <div className="space-y-3" data-testid="gm-board-step-notes">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <NotesBox id="gm-board-notes" label={`Notes for ${phaseTitle}`} notes={notes} onChange={onChange} readOnly={readOnly} />
        <NotesBox id="gm-board-game-notes" label="Notes for every phase" notes={gameNotes} onChange={onGameChange} readOnly={readOnly} />
      </div>
      {!readOnly && <p className="text-sm text-content-tertiary">Saved as you type. Only you and your co-GMs can see these, unless you share the board.</p>}
    </div>
  );
}

interface NotesBoxProps {
  id: string;
  label: string;
  notes: string;
  onChange: (text: string) => void;
  readOnly: boolean;
}

function NotesBox({ id, label, notes, onChange, readOnly }: NotesBoxProps) {
  const { text, setText, bind } = useBoundText(notes);

  if (readOnly) {
    return (
      <section data-testid={id}>
        <h2 className="mb-2 text-base font-semibold text-content-primary">{label}</h2>
        {notes.trim() ? <MarkdownPreview content={notes} /> : <p className="text-content-tertiary">No notes.</p>}
      </section>
    );
  }
  return (
    // React's focus events bubble, so the wrapper sees the editor's box gain and lose focus.
    <section className="min-w-0" {...bind}>
      <label htmlFor={id} className="mb-2 block text-base font-semibold text-content-primary">
        {label}
      </label>
      <CommentEditor
        id={id}
        textareaTestId={id}
        value={text}
        onChange={(next) => {
          setText(next);
          onChange(next);
        }}
        rows={24}
        maxLength={100000}
        placeholder="Plans, reminders, what the players are up to…"
      />
    </section>
  );
}
