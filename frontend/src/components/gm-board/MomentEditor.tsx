import { useEffect, useRef, type KeyboardEvent, type SyntheticEvent } from 'react';
import { Badge, Button, Textarea } from '@/components/ui';
import { useBoundText } from '@/hooks/useBoundText';
import { cardLabel, OUTCOMES } from '@/lib/gmBoard/cards';
import { isNote, readerText, reads } from '@/lib/gmBoard/moments';
import { dropOwnText, ownTextReaders, readersNote, setOwnText, setReader } from '@/lib/gmBoard/scenes';
import { shortName, truncate } from '@/lib/gmBoard/text';
import type { Moment } from '@/lib/gmBoard/types';
import { ReaderChips } from './ReaderChips';
import { momentTextId, type MomentActions, type SceneModel } from './sceneTypes';

interface MomentEditorProps {
  moment: Moment;
  index: number;
  model: SceneModel;
  actions: MomentActions;
  focused: boolean;
  /** Put the cursor in its text when it first shows (a moment just added with Ctrl+Enter). */
  autoFocus?: boolean;
}

/**
 * One moment: who reads it, its text with names in it, and any reader's own
 * version. With nobody ticked it's a private GM note. Ctrl+Enter adds a
 * moment below.
 */
export function MomentEditor({ moment, index, model, actions, focused, autoFocus }: MomentEditorProps) {
  const number = index + 1;
  const note = isNote(moment);
  const last = index === model.scene.moments.length - 1;
  const name = (id: number) => shortName(model.names.get(id) ?? `Character ${id}`);
  const under = readersNote(moment, model.scene, model.canRead, model.names);
  const change = (fn: (m: Moment) => Moment) => actions.change(moment.id, fn);

  if (model.readOnly) {
    const readers = model.readers.filter((id) => reads(moment, id));
    return (
      <section
        aria-label={`Moment ${number}`}
        id={`moment-${moment.id}`}
        data-testid={`moment-${moment.id}`}
        className={`space-y-2 rounded-lg border p-3 ${focused ? 'border-theme-strong' : 'border-theme-default'} ${note ? 'surface-sunken' : 'surface-base'}`}
      >
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="neutral" size="sm">
            {number}
          </Badge>
          {note ? (
            <span className="text-xs text-content-tertiary">GM note: nobody reads it</span>
          ) : (
            readers.map((id) => (
              <Badge key={id} variant={typeof moment.ownText[id] === 'string' ? 'primary' : 'neutral'} size="sm">
                {typeof moment.ownText[id] === 'string' ? '✎' : '✓'} {name(id)}
              </Badge>
            ))
          )}
        </div>
        <MomentSource moment={moment} model={model} />
        {moment.text.trim() ? (
          <p className="whitespace-pre-wrap text-content-primary">{moment.text}</p>
        ) : (
          <p className="text-sm text-content-tertiary">Nothing written yet.</p>
        )}
        {ownTextReaders(moment).map((id) => (
          <div key={id} className="border-l-4 border-semantic-info pl-2">
            <p className="text-xs font-medium text-content-secondary">{name(id)} reads instead</p>
            <p className="whitespace-pre-wrap text-content-primary">{moment.ownText[id]}</p>
          </div>
        ))}
        {under && <p className="text-xs text-content-secondary">{under}</p>}
      </section>
    );
  }

  return (
    <section
      aria-label={`Moment ${number}`}
      id={`moment-${moment.id}`}
      data-testid={`moment-${moment.id}`}
      className={`space-y-2 rounded-lg border p-3 ${focused ? 'border-theme-strong' : 'border-theme-default'} ${note ? 'surface-sunken' : 'surface-base'}`}
      onFocusCapture={() => !focused && actions.focus(moment.id)}
    >
      <div className="flex items-start gap-2">
        <Badge variant="neutral" size="sm">
          {number}
        </Badge>
        <div className="min-w-0 flex-1">
          <ReaderChips
            moment={moment}
            number={number}
            model={model}
            onToggle={(id, on) => change((m) => setReader(m, id, on))}
            onOwnText={(id) => change((m) => setOwnText(m, id, readerText(m, id, model.nameLists.get(id) ?? [], model.secondPerson)))}
            onAddElsewhere={(id) => change((m) => setReader(m, id, true))}
          />
        </div>
        <div className="flex shrink-0 gap-0.5">
          <Button type="button" size="sm" variant="ghost" className="!px-1.5" disabled={index === 0} aria-label={`Move moment ${number} up`} onClick={() => actions.move(moment.id, -1)}>
            ↑
          </Button>
          <Button type="button" size="sm" variant="ghost" className="!px-1.5" disabled={last} aria-label={`Move moment ${number} down`} onClick={() => actions.move(moment.id, 1)}>
            ↓
          </Button>
          <Button type="button" size="sm" variant="ghost" className="!px-1.5" aria-label={`Delete moment ${number}`} onClick={() => actions.remove(moment.id)}>
            ✕
          </Button>
        </div>
      </div>

      <MomentSource moment={moment} model={model} />

      <MomentText
        id={momentTextId(moment.id, null)}
        label={note ? 'GM note: nobody is ticked, so only you see this' : 'What happens, with names'}
        placeholder={note ? 'What really happened, for your eyes only' : 'Mara lifts the lantern and the hall goes quiet.'}
        rows={note ? 2 : 3}
        saved={moment.text}
        autoFocus={autoFocus}
        onChange={(text) => change((m) => ({ ...m, text }))}
        field={(start, end) => actions.field({ momentId: moment.id, readerId: null, start, end })}
        onAddBelow={() => actions.addAfter(moment.id)}
      />

      {ownTextReaders(moment).map((id) => (
        <div key={id} className="flex items-start gap-1 border-l-4 border-semantic-info pl-2">
          <div className="min-w-0 flex-1">
            <MomentText
              id={momentTextId(moment.id, id)}
              label={`${name(id)} reads instead`}
              rows={2}
              saved={moment.ownText[id] ?? ''}
              onChange={(text) => change((m) => setOwnText(m, id, text))}
              field={(start, end) => actions.field({ momentId: moment.id, readerId: id, start, end })}
              onAddBelow={() => actions.addAfter(moment.id)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="mt-6 !px-1.5"
            title="Back to the shared text"
            aria-label={`Remove ${name(id)}’s own version`}
            onClick={() => change((m) => dropOwnText(m, id))}
          >
            ✕
          </Button>
        </div>
      ))}

      {under && <p className="text-xs text-content-secondary">{under}</p>}
    </section>
  );
}

/** The plan card or submission passage a moment was started from, folded. */
function MomentSource({ moment, model }: { moment: Moment; model: SceneModel }) {
  const card = moment.cardId ? model.board.cards.find((c) => c.id === moment.cardId) : undefined;
  if (card) {
    const outcome = OUTCOMES.find((o) => o.value === card.outcome);
    const who = shortName(model.names.get(card.characterId) ?? `Character ${card.characterId}`);
    return (
      <details className="rounded border border-theme-subtle px-2 py-1 text-sm">
        <summary className="cursor-pointer text-content-secondary">
          From {who}’s {card.gm ? 'GM card' : 'plan'}: <span className="text-content-primary">{truncate(cardLabel(card), 70)}</span>{' '}
          {outcome && (
            <Badge variant={outcome.tone} size="sm">
              {outcome.label}
            </Badge>
          )}
        </summary>
        {card.cond && <p className="text-xs text-content-secondary">If {card.cond}</p>}
        {card.quote && <blockquote className="mt-1 whitespace-pre-wrap text-content-primary">“{card.quote}”</blockquote>}
        {card.note && <p className="mt-1 text-xs text-content-secondary">GM note: {card.note}</p>}
      </details>
    );
  }
  if (moment.ref?.quote) {
    const who = shortName(model.names.get(moment.ref.characterId) ?? `Character ${moment.ref.characterId}`);
    return (
      <details className="rounded border border-theme-subtle px-2 py-1 text-sm">
        <summary className="cursor-pointer text-content-secondary">From {who}’s submission</summary>
        <blockquote className="mt-1 whitespace-pre-wrap text-content-primary">“{moment.ref.quote}”</blockquote>
      </details>
    );
  }
  return null;
}

interface MomentTextProps {
  id: string;
  label: string;
  placeholder?: string;
  rows: number;
  saved: string;
  autoFocus?: boolean;
  onChange: (text: string) => void;
  /** Where the cursor is, for Insert. */
  field: (start: number, end: number) => void;
  onAddBelow: () => void;
}

/** A moment's text box. It keeps its own text while focused (see useBoundText). */
function MomentText({ id, label, placeholder, rows, saved, autoFocus, onChange, field, onAddBelow }: MomentTextProps) {
  const bound = useBoundText(saved);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const report = (e: SyntheticEvent<HTMLTextAreaElement>) => field(e.currentTarget.selectionStart, e.currentTarget.selectionEnd);
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onAddBelow();
    }
  };

  return (
    <Textarea
      ref={ref}
      id={id}
      label={label}
      placeholder={placeholder}
      rows={rows}
      value={bound.text}
      onFocus={bound.bind.onFocus}
      onBlur={(e) => {
        report(e);
        bound.bind.onBlur();
      }}
      onChange={(e) => {
        bound.setText(e.target.value);
        onChange(e.target.value);
      }}
      onSelect={report}
      onKeyDown={onKeyDown}
    />
  );
}
