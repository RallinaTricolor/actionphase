import { useMemo, useState } from 'react';
import { Badge, Button, Checkbox } from '@/components/ui';
import { MarkdownPreview } from '@/components/common/markdown/MarkdownPreview';
import { briefFor, type BriefScene } from '@/lib/gmBoard/brief';
import { cardLabel, isIF, OUTCOMES } from '@/lib/gmBoard/cards';
import { readerVersion } from '@/lib/gmBoard/moments';
import { STANCES } from '@/lib/gmBoard/stances';
import { shortName, truncate } from '@/lib/gmBoard/text';
import type { Card, Moment } from '@/lib/gmBoard/types';
import { STATE_LABELS, STATE_TONE } from './mapModel';
import type { WriteModel } from './writeTypes';
import { YouKey } from './YouKey';
import { YouText } from './YouText';

interface WriteBriefProps {
  model: WriteModel;
  characterId: number;
  /** Everyone on the Write list, for stances. */
  others: number[];
  submission?: string;
  isCovered: (moment: Moment) => boolean;
  coverage: { done: number; total: number };
  onCovered: (momentId: string, covered: boolean) => void;
  /** Puts the text in the draft at the cursor and ticks the moment covered. Absent when there's no draft to type into. */
  onInsert?: (moment: Moment, text: string) => void;
  onCopy: (text: string) => void;
  onOpenScene: (sceneId: string) => void;
}

const stanceLabel = (value: string) => STANCES.find((s) => s.value === value)?.label ?? value;

/**
 * One character's phase in time order, to write their result from: their
 * cards with outcomes, the moments they read (as they read them), what their
 * scenes hold that they don't get, and what changed for them.
 */
export function WriteBrief({ model, characterId, others, submission, isCovered, coverage, onCovered, onInsert, onCopy, onOpenScene }: WriteBriefProps) {
  const [showMoot, setShowMoot] = useState(false);
  const brief = useMemo(() => briefFor(model.board, characterId, others, showMoot), [model.board, characterId, others, showMoot]);
  const name = shortName(model.names.get(characterId) ?? `Character ${characterId}`);
  const who = (id: number) => shortName(model.names.get(id) ?? `Character ${id}`);
  const names = model.nameLists.get(characterId) ?? [];

  const causeLabel = (id: string) => {
    const scene = model.board.scenes.find((s) => s.id === id);
    if (scene) return model.sceneName(scene);
    const card = model.board.cards.find((c) => c.id === id);
    return card ? `${who(card.characterId)}: ${truncate(cardLabel(card), 50)}` : 'something deleted';
  };

  const cardRow = (card: Card, waiting = false) => {
    const outcome = OUTCOMES.find((o) => o.value === card.outcome);
    return (
      <li key={card.id} className={`space-y-0.5 text-sm ${card.outcome === 'moot' || waiting ? 'opacity-60' : ''}`} data-testid={`brief-card-${card.id}`}>
        <div className="flex flex-wrap items-baseline gap-1.5">
          <span className="text-xs text-content-tertiary">{card.gm ? 'GM' : 'Plan'}</span>
          {waiting ? <Badge size="sm">Never triggered</Badge> : outcome && <Badge variant={outcome.tone} size="sm">{outcome.label}</Badge>}
          {isIF(card) && (
            <Badge variant="primary" size="sm">
              IF{card.cond ? `: ${truncate(card.cond, 60)}` : ''}
            </Badge>
          )}
          <span className="text-content-primary">{cardLabel(card)}</span>
        </div>
        {card.causedBy.length > 0 && <p className="text-xs text-content-secondary">because of {card.causedBy.map(causeLabel).join('; ')}</p>}
        {card.note && <p className="text-xs text-content-secondary">GM note: {card.note}</p>}
        {card.quote && (
          <details className="text-xs">
            <summary className="cursor-pointer text-content-tertiary">Their words</summary>
            <p className="mt-1 whitespace-pre-wrap text-content-secondary">“{card.quote}”</p>
          </details>
        )}
      </li>
    );
  };

  const sceneBlock = ({ scene, here, moments, hidden }: BriefScene) => (
    <li key={scene.id} className="space-y-1" data-testid={`brief-scene-${scene.id}`}>
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="text-xs text-content-tertiary">Scene</span>
        <Button type="button" variant="ghost" size="sm" className="!px-1 !py-0 underline" onClick={() => onOpenScene(scene.id)}>
          {model.sceneName(scene)}
        </Button>
        {!here && <span className="text-xs text-content-tertiary">from elsewhere</span>}
        {scene.conflict && (
          <Badge variant="danger" size="sm">
            Conflict
          </Badge>
        )}
      </div>
      {here && !moments.length && !hidden.length && <p className="text-xs text-content-tertiary">Present, but there’s nothing for {name} to read here yet.</p>}
      <ul className="space-y-1">
        {moments.map((m) => {
          const version = readerVersion(m, characterId, names, model.secondPerson);
          const covered = isCovered(m);
          const own = !!m.ownText[characterId]?.trim();
          const notEveryone = scene.participants.some((p) => p !== characterId && model.cast.get(p)?.reads && !m.readers.includes(p));
          return (
            <li key={m.id} className={`flex items-start gap-2 rounded px-1.5 py-1 text-sm ${covered ? 'surface-sunken' : ''}`} data-testid={`brief-moment-${m.id}`}>
              <Checkbox
                id={`covered-${characterId}-${m.id}`}
                aria-label={`Covered in ${name}’s result: ${truncate(version.text, 60)}`}
                checked={covered}
                onChange={(e) => onCovered(m.id, e.target.checked)}
              />
              <span className="min-w-0 flex-1 text-content-primary">
                <YouText result={version} />
                {(!here || notEveryone) && (
                  <>
                    {' '}
                    <Badge variant="warning" size="sm">
                      private
                    </Badge>
                  </>
                )}
                {own && (
                  <>
                    {' '}
                    <Badge variant="primary" size="sm">
                      own
                    </Badge>
                  </>
                )}
              </span>
              <span className="flex shrink-0 gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => onCopy(version.text)}>
                  Copy
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!onInsert}
                  title={onInsert ? 'Put it in the draft at the cursor and tick it' : 'Every result is published: add another result first'}
                  onClick={() => onInsert?.(m, version.text)}
                >
                  Insert
                </Button>
              </span>
            </li>
          );
        })}
        {hidden.map(({ moment, note }) => (
          <li key={moment.id} className="rounded border border-dashed border-theme-default px-1.5 py-1 text-xs text-content-tertiary" data-testid={`brief-hidden-${moment.id}`}>
            <span className="text-content-secondary">{truncate(moment.text, 140)}</span> · {note ? 'GM note: nobody reads this' : `${name} doesn’t get this`}
          </li>
        ))}
      </ul>
    </li>
  );

  const pct = coverage.total ? Math.round((100 * coverage.done) / coverage.total) : 0;

  return (
    <section aria-label={`${name}’s brief`} className="space-y-4" data-testid="write-brief">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-content-primary">{name}’s phase, in order</h3>
        <div className="flex items-center gap-2 text-xs text-content-secondary">
          <span>
            {coverage.done} of {coverage.total} moments covered
          </span>
          <span className="h-1.5 w-24 overflow-hidden rounded surface-sunken" aria-hidden="true">
            <span className="block h-full bg-semantic-success" style={{ width: `${pct}%` }} />
          </span>
        </div>
        {(brief.stances.out.length > 0 || brief.stances.in.length > 0) && (
          <ul className="space-y-0.5 text-xs">
            {brief.stances.out.map(({ id, stance }) => (
              <li key={`o${id}`} className="text-content-primary">
                {stanceLabel(stance.value)} → <b>{who(id)}</b>
                {stance.note && <span className="text-content-tertiary"> · {stance.note}</span>}
              </li>
            ))}
            {brief.stances.in.map(({ id, stance }) => (
              <li key={`i${id}`} className="text-content-tertiary">
                {who(id)} toward {name}: {stanceLabel(stance.value)} (GM only)
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs text-content-secondary">
          End of phase: <Badge variant={STATE_TONE[brief.endState]} size="sm">{STATE_LABELS[brief.endState]}</Badge>
          {(brief.mootCount > 0 || brief.waiting.length > 0) && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowMoot((v) => !v)} aria-pressed={showMoot}>
              {showMoot ? 'Hide' : 'Show'} moot and never triggered ({brief.mootCount + brief.waiting.length})
            </Button>
          )}
        </div>
        <details className="text-xs text-content-tertiary">
          <summary className="cursor-pointer">How this works</summary>
          <p className="mt-1">
            {name}’s plans, your notes, what {name} reads in each scene and what changed for them, time slot by time slot. Dashed rows are things {name} must
            not learn. A tick means the draft covers that moment: it ticks itself when the text is in any of {name}’s results, and Insert ticks it too.
          </p>
          {model.secondPerson && <YouKey />}
        </details>
      </div>

      {brief.slots.length === 0 && brief.waiting.length === 0 ? (
        <p className="text-sm text-content-secondary">Nothing on the board for {name} yet.</p>
      ) : (
        brief.slots.map((slot) => {
          const where = [
            ...new Set([...slot.cards.filter((c) => c.outcome !== 'moot').map((c) => c.locationId), ...slot.scenes.map((s) => s.scene.locationId)]),
          ]
            .map(model.placeName)
            .join(', ');
          return (
            <div key={slot.chunk.id} className="space-y-2 border-t border-theme-default pt-2" data-testid={`brief-slot-${slot.chunk.id}`}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-content-secondary">
                {slot.chunk.name} {where && <span className="font-normal normal-case text-content-tertiary">{where}</span>}
              </h4>
              {slot.cards.length > 0 && <ul className="space-y-1.5">{slot.cards.map((c) => cardRow(c))}</ul>}
              {slot.scenes.length > 0 && <ul className="space-y-2">{slot.scenes.map(sceneBlock)}</ul>}
              {slot.effects.map((e, i) => (
                <p key={i} className="text-xs text-content-secondary">
                  Becomes <Badge variant={STATE_TONE[e.state]} size="sm">{STATE_LABELS[e.state]}</Badge>
                  {e.untilChunkId && ` until ${model.slotName(e.untilChunkId)}`}
                </p>
              ))}
            </div>
          );
        })
      )}
      {showMoot && brief.waiting.length > 0 && (
        <div className="space-y-2 border-t border-theme-default pt-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-content-secondary">Contingencies, never triggered</h4>
          <ul className="space-y-1.5">{brief.waiting.map((c) => cardRow(c, true))}</ul>
        </div>
      )}

      {submission && (
        <details className="border-t border-theme-default pt-2">
          <summary className="cursor-pointer text-sm font-semibold text-content-primary">Full submission</summary>
          <div className="mt-2">
            <MarkdownPreview content={submission} fullWidth />
          </div>
        </details>
      )}
    </section>
  );
}
