import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { ActionResult } from '@/types/phases';

/** How long after the last keystroke a draft saves. */
export const DRAFT_SAVE_DELAY_MS = 1000;

/**
 * What the editor is writing into: a saved draft part, a character's next
 * result (made on the first keystroke; the first one links their
 * submission), or a new part on the end of a draft chain.
 */
export type DraftTarget =
  | { kind: 'part'; part: ActionResult }
  | { kind: 'new-result'; userId: number; characterId: number; submissionId?: number }
  | { kind: 'new-part'; tail: ActionResult; delayMinutes: number };

export type DraftStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'conflict' | 'gone' | 'published' | 'error';

const resultsKey = (gameId: number) => ['actionResults', 'game', gameId] as const;

/** Newer by the clock, to the millisecond. */
const isNewer = (a: string | undefined, b: string | undefined) => !!a && (!b || Date.parse(a) > Date.parse(b));

/**
 * One draft part's text, saved to its `action_results` row about a second
 * after the GM stops typing. Each save sends the `updated_at` it last saw,
 * so a save over a co-GM's newer one is refused (409) instead of landing:
 * the hook then holds the GM's text and offers "Use theirs" and "Keep mine".
 *
 * A `new-result` or `new-part` target creates its row on the first save of
 * non-blank text and reports it with `onCreated`; the caller should keep the
 * same component mounted (same React key) when it switches the target to
 * that part, or typing in between is lost.
 *
 * Unsaved text is sent when the component unmounts, and the page warns
 * before closing while a save is outstanding.
 */
export function useResultDraft(gameId: number, target: DraftTarget, onCreated?: (result: ActionResult) => void) {
  const qc = useQueryClient();
  const initial = target.kind === 'part' ? target.part : null;
  const [text, setTextState] = useState(initial?.content ?? '');
  const [status, setStatus] = useState<DraftStatus>('idle');
  const [theirs, setTheirs] = useState<ActionResult | null>(null);

  // Refs, so the timer and the unmount flush see the latest values.
  const textRef = useRef(text);
  const idRef = useRef<number | null>(initial?.id ?? null);
  const seenRef = useRef<string | undefined>(initial?.updated_at);
  const savedTextRef = useRef(initial?.content ?? '');
  const targetRef = useRef(target);
  targetRef.current = target;
  const onCreatedRef = useRef(onCreated);
  onCreatedRef.current = onCreated;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const blocked = useRef(false);

  // A newer copy of this part arrived (someone else saved, or a refetch after
  // another step wrote to it) while nothing is waiting to save: show it.
  const prop = target.kind === 'part' ? target.part : null;
  useEffect(() => {
    if (!prop || prop.id !== idRef.current) return;
    if (textRef.current !== savedTextRef.current || inFlight.current) return;
    if (!isNewer(prop.updated_at, seenRef.current)) return;
    seenRef.current = prop.updated_at;
    savedTextRef.current = prop.content;
    textRef.current = prop.content;
    setTextState(prop.content);
  }, [prop]);

  const patchCache = useCallback(
    (id: number, content: string, updatedAt: string | undefined) =>
      qc.setQueryData<ActionResult[]>(resultsKey(gameId), (list) =>
        list?.map((r) => (r.id === id ? { ...r, content, updated_at: updatedAt ?? r.updated_at } : r)),
      ),
    [qc, gameId],
  );

  const save = useCallback(async (): Promise<void> => {
    if (inFlight.current) {
      await inFlight.current;
      if (textRef.current === savedTextRef.current) return;
    }
    if (blocked.current) return;
    const sent = textRef.current;
    if (sent === savedTextRef.current) return;
    const t = targetRef.current;
    const id = idRef.current;
    // Nothing to make a row for yet.
    if (id === null && !sent.trim()) return;

    const run = (async () => {
      setStatus('saving');
      try {
        if (id !== null) {
          const res = await apiClient.phases.updateActionResult(gameId, id, { content: sent, expected_updated_at: seenRef.current });
          seenRef.current = res.data.updated_at ?? seenRef.current;
          savedTextRef.current = sent;
          patchCache(id, sent, res.data.updated_at);
        } else if (t.kind === 'new-result') {
          const res = await apiClient.phases.createActionResult(gameId, {
            user_id: t.userId,
            character_id: t.characterId,
            action_submission_id: t.submissionId,
            content: sent,
            is_published: false,
          });
          idRef.current = res.data.id;
          seenRef.current = res.data.updated_at;
          // The server trims what it creates; the box keeps what was typed,
          // and the next save sends it whole.
          savedTextRef.current = sent;
          void qc.invalidateQueries({ queryKey: resultsKey(gameId) });
          void qc.invalidateQueries({ queryKey: ['unpublishedResultsCount'] });
          onCreatedRef.current?.({ ...(res.data as ActionResult), character_id: t.characterId, action_submission_id: t.submissionId });
        } else if (t.kind === 'new-part') {
          const res = await apiClient.phases.appendStagedPart(gameId, t.tail.id, { content: sent.trim(), delay_minutes: t.delayMinutes });
          idRef.current = res.data.id;
          seenRef.current = res.data.updated_at;
          savedTextRef.current = sent;
          void qc.invalidateQueries({ queryKey: resultsKey(gameId) });
          void qc.invalidateQueries({ queryKey: ['unpublishedResultsCount'] });
          onCreatedRef.current?.(res.data);
        }
        setStatus(textRef.current === savedTextRef.current ? 'saved' : 'unsaved');
      } catch (error) {
        const code = isAxiosError(error) ? error.response?.status : undefined;
        if (code === 409 && id !== null) {
          // Published, or saved by someone else. Find out which from the
          // current list; the GM's text stays in the box either way.
          await qc.invalidateQueries({ queryKey: resultsKey(gameId) });
          const current = qc.getQueryData<ActionResult[]>(resultsKey(gameId))?.find((r) => r.id === id) ?? null;
          blocked.current = true;
          if (current?.is_published) setStatus('published');
          else {
            setTheirs(current);
            setStatus(current ? 'conflict' : 'gone');
          }
        } else if (code === 404) {
          blocked.current = true;
          setStatus('gone');
          void qc.invalidateQueries({ queryKey: resultsKey(gameId) });
        } else {
          setStatus('error');
        }
      }
    })();
    inFlight.current = run;
    try {
      await run;
    } finally {
      inFlight.current = null;
    }
  }, [gameId, patchCache, qc]);

  const setText = useCallback(
    (next: string) => {
      textRef.current = next;
      setTextState(next);
      if (blocked.current) return;
      setStatus(next === savedTextRef.current ? 'saved' : 'unsaved');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void save();
      }, DRAFT_SAVE_DELAY_MS);
    },
    [save],
  );

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    await save();
  }, [save]);

  /** Drop the GM's text for the copy someone else saved. */
  const takeTheirs = useCallback(() => {
    if (!theirs) return;
    blocked.current = false;
    seenRef.current = theirs.updated_at;
    savedTextRef.current = theirs.content;
    textRef.current = theirs.content;
    setTextState(theirs.content);
    setTheirs(null);
    setStatus('saved');
  }, [theirs]);

  /** Save the GM's text over the copy someone else saved. */
  const keepMine = useCallback(() => {
    if (!theirs) return;
    blocked.current = false;
    seenRef.current = theirs.updated_at;
    savedTextRef.current = theirs.content;
    setTheirs(null);
    void save();
  }, [theirs, save]);

  // Send what's waiting when the editor goes away (another part, another step).
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        void save();
      }
    },
    [save],
  );

  const pending = status === 'unsaved' || status === 'saving';
  useEffect(() => {
    if (!pending) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pending]);

  return { text, setText, status, flush, theirs, takeTheirs, keepMine, resultId: idRef.current };
}

/**
 * Adds text to the end of a character's draft from outside the Write
 * editor (Scenes' "Add to draft"): to `target`, a blank line before it, or
 * as their next result when `target` is null. A stale save is retried once
 * against the current copy, since adding to the end is safe to repeat on
 * whatever someone else saved. Returns the part written to.
 */
export function useAppendToDraft(gameId: number) {
  const qc = useQueryClient();
  return useCallback(
    async (
      target: ActionResult | null,
      text: string,
      recipient: { userId: number; characterId: number; submissionId?: number },
    ): Promise<ActionResult> => {
      const refresh = () => qc.invalidateQueries({ queryKey: resultsKey(gameId) });
      if (!target) {
        const res = await apiClient.phases.createActionResult(gameId, {
          user_id: recipient.userId,
          character_id: recipient.characterId,
          action_submission_id: recipient.submissionId,
          content: text,
          is_published: false,
        });
        await refresh();
        void qc.invalidateQueries({ queryKey: ['unpublishedResultsCount'] });
        return { ...(res.data as ActionResult), character_id: recipient.characterId };
      }
      const put = (base: ActionResult) =>
        apiClient.phases.updateActionResult(gameId, base.id, {
          content: base.content.replace(/\s+$/, '') ? `${base.content.replace(/\s+$/, '')}\n\n${text}` : text,
          expected_updated_at: base.updated_at,
        });
      try {
        await put(target);
      } catch (error) {
        if (!isAxiosError(error) || error.response?.status !== 409) throw error;
        await refresh();
        const fresh = qc.getQueryData<ActionResult[]>(resultsKey(gameId))?.find((r) => r.id === target.id);
        if (!fresh || fresh.is_published) throw error;
        await put(fresh);
      }
      await refresh();
      return target;
    },
    [gameId, qc],
  );
}

/**
 * Rewrites a draft part's whole text through the API, for a part the editor
 * isn't showing (Put block in result). Sends the updated_at it last saw; on a
 * 409 it reloads the part and tries once more on the fresh copy.
 */
export function useRewriteDraft(gameId: number) {
  const qc = useQueryClient();
  return useCallback(
    async (target: ActionResult, fn: (text: string) => string): Promise<void> => {
      const refresh = () => qc.invalidateQueries({ queryKey: resultsKey(gameId) });
      const put = (base: ActionResult) =>
        apiClient.phases.updateActionResult(gameId, base.id, { content: fn(base.content), expected_updated_at: base.updated_at });
      try {
        await put(target);
      } catch (error) {
        if (!isAxiosError(error) || error.response?.status !== 409) throw error;
        await refresh();
        const fresh = qc.getQueryData<ActionResult[]>(resultsKey(gameId))?.find((r) => r.id === target.id);
        if (!fresh || fresh.is_published) throw error;
        await put(fresh);
      }
      await refresh();
    },
    [gameId, qc],
  );
}
