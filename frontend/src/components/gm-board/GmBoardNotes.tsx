import { useState } from 'react';
import { Button, Textarea } from '@/components/ui';
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
 * The GM's scratch notes, in the board's side panel: the game's, which every
 * phase's board shows, and this phase's. Markdown, with a preview. Each box
 * keeps its own text while focused (see `useBoundText`).
 */
export function GmBoardNotes({ phaseTitle, notes, onChange, gameNotes, onGameChange, readOnly = false }: GmBoardNotesProps) {
  return (
    <div className="space-y-6">
      <NotesBox id="gm-board-game-notes" label="Notes for every phase" notes={gameNotes} onChange={onGameChange} readOnly={readOnly} rows={8} />
      <NotesBox id="gm-board-notes" label={`Notes for ${phaseTitle}`} notes={notes} onChange={onChange} readOnly={readOnly} rows={16} />
      {!readOnly && <p className="text-sm text-content-tertiary">Markdown works here. Only you and your co-GMs can see these, unless you share the board.</p>}
    </div>
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
  const [preview, setPreview] = useState(false);

  if (readOnly) {
    return (
      <div data-testid={id}>
        <h3 className="text-sm font-medium text-content-primary mb-2">{label}</h3>
        {notes.trim() ? <MarkdownPreview content={notes} /> : <p className="text-content-tertiary">No notes.</p>}
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-end gap-1" role="group" aria-label={`${label}: view`}>
        <Button type="button" size="sm" variant={preview ? 'ghost' : 'secondary'} aria-pressed={!preview} onClick={() => setPreview(false)}>
          Write
        </Button>
        <Button type="button" size="sm" variant={preview ? 'secondary' : 'ghost'} aria-pressed={preview} onClick={() => setPreview(true)}>
          Preview
        </Button>
      </div>
      {preview ? (
        <div data-testid={`${id}-preview`}>
          <h3 className="text-sm font-medium text-content-primary mb-2">{label}</h3>
          {text.trim() ? <MarkdownPreview content={text} /> : <p className="text-content-tertiary">Nothing to preview.</p>}
        </div>
      ) : (
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
      )}
    </div>
  );
}
