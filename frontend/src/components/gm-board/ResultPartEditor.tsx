import { useEffect, type MutableRefObject } from 'react';
import { Alert, Button } from '@/components/ui';
import { CommentEditor } from '@/components/messages/CommentEditor';
import { useResultDraft, type DraftStatus, type DraftTarget } from '@/hooks/useResultDraft';
import type { SheetItem } from '@/hooks/useCharacterSheetItems';
import { wordCount } from '@/lib/gmBoard/scenes';
import type { ActionResult } from '@/types/phases';

interface ResultPartEditorProps {
  gameId: number;
  target: DraftTarget;
  onCreated: (result: ActionResult) => void;
  /** The text as typed, saved or not, for the coverage and leak checks. */
  onText: (text: string) => void;
  insertTextRef: MutableRefObject<((text: string) => void) | null>;
  transformTextRef: MutableRefObject<((fn: (text: string) => string) => void) | null>;
  /** Set to this editor's flush, so Publish can send waiting text first. */
  flushRef: MutableRefObject<(() => Promise<void>) | null>;
  /** Set to rewrite this part's whole text (Put block in result), saved as typing is. */
  rewriteRef?: MutableRefObject<((fn: (text: string) => string) => void) | null>;
  placeholder: string;
  sheetItems?: SheetItem[];
  label: string;
}

const STATUS_TEXT: Partial<Record<DraftStatus, string>> = {
  unsaved: 'Not saved yet',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Couldn’t save. It’ll try again as you type.',
};

/** The draft for one result part, saved as the GM types (see `useResultDraft`). */
export function ResultPartEditor({ gameId, target, onCreated, onText, insertTextRef, transformTextRef, flushRef, rewriteRef, placeholder, sheetItems, label }: ResultPartEditorProps) {
  const draft = useResultDraft(gameId, target, onCreated);
  const { text, flush, setText } = draft;

  useEffect(() => onText(text), [text, onText]);
  useEffect(() => {
    flushRef.current = flush;
    return () => {
      if (flushRef.current === flush) flushRef.current = null;
    };
  }, [flush, flushRef]);

  const locked = draft.status === 'published' || draft.status === 'gone';
  useEffect(() => {
    if (!rewriteRef || locked) return;
    const rewrite = (fn: (t: string) => string) => setText(fn(text));
    rewriteRef.current = rewrite;
    return () => {
      if (rewriteRef.current === rewrite) rewriteRef.current = null;
    };
  }, [rewriteRef, locked, setText, text]);

  return (
    <div className="space-y-2" data-testid="result-part-editor">
      {draft.status === 'conflict' && draft.theirs && (
        <Alert variant="warning" title="Someone else saved this part">
          <p className="text-sm">Your text is still here and hasn’t been saved. Their version:</p>
          <p className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded surface-sunken p-2 text-sm">{draft.theirs.content || '(empty)'}</p>
          <div className="mt-2 flex gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={draft.takeTheirs}>
              Use theirs
            </Button>
            <Button type="button" size="sm" variant="primary" onClick={draft.keepMine}>
              Keep mine
            </Button>
          </div>
        </Alert>
      )}
      {draft.status === 'published' && <Alert variant="info">This part was published meanwhile, so it can’t be changed. Copy anything you need from the box.</Alert>}
      {draft.status === 'gone' && <Alert variant="warning">This part was deleted meanwhile. Copy anything you need from the box.</Alert>}
      <CommentEditor
        value={text}
        onChange={draft.setText}
        rows={14}
        placeholder={placeholder}
        maxLength={100000}
        sheetItems={sheetItems}
        insertTextRef={locked ? undefined : insertTextRef}
        transformTextRef={locked ? undefined : transformTextRef}
        textareaTestId="result-draft"
        id="result-draft"
      />
      <div className="flex items-center justify-between text-xs text-content-tertiary">
        <span aria-live="polite" data-testid="result-draft-status">
          {label} · {draft.status === 'idle' ? (target.kind === 'part' ? 'Saved' : 'Saved as you type') : (STATUS_TEXT[draft.status] ?? '')}
        </span>
        <span>{wordCount(text)} words</span>
      </div>
    </div>
  );
}
