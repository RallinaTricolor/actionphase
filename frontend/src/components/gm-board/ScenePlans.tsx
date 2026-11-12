import { Badge, Button, Select } from '@/components/ui';
import CharacterAvatar from '@/components/characters/CharacterAvatar';
import { cardLabel, isIF, isWaiting, OUTCOMES, shownCondition } from '@/lib/gmBoard/cards';
import { nearby, plansFor } from '@/lib/gmBoard/scenes';
import { STANCES, stanceOf } from '@/lib/gmBoard/stances';
import { stateAt } from '@/lib/gmBoard/states';
import { shortName, truncate } from '@/lib/gmBoard/text';
import type { Card, CodexEntry, Outcome } from '@/lib/gmBoard/types';
import { STATE_LABELS, STATE_TONE } from './mapModel';
import type { SceneModel } from './sceneTypes';

interface ScenePlansProps {
  model: SceneModel;
  /** The scene's location, for its notes. */
  location: CodexEntry | undefined;
  /** A row name for any location id, for cards elsewhere. */
  placeName: (locationId: string) => string;
  slotName: (chunkId: string | null) => string;
  onSetOutcome: (card: Card, outcome: Outcome) => void;
  /** A waiting IF card happens in this scene. */
  onTrigger: (card: Card) => void;
  onMomentFromCard: (card: Card) => void;
  onJoin: (characterId: number) => void;
  /** Opens the card in the card panel, for its note, causes, text and place. */
  onOpenCard: (cardId: string) => void;
}

/**
 * The Plans tab: for each person in the scene, their stances toward the
 * others, their cards in this time slot with outcomes, their waiting IF
 * cards, and their other cards. Then anyone else at this place and time.
 */
export function ScenePlans({ model, location, placeName, slotName, onSetOutcome, onTrigger, onMomentFromCard, onJoin, onOpenCard }: ScenePlansProps) {
  const { scene, board } = model;
  const others = nearby(board, scene);
  const name = (id: number) => model.names.get(id) ?? `Character ${id}`;

  const row = (card: Card, showWhere: boolean) => {
    const label = cardLabel(card);
    const cond = shownCondition(card, label);
    const used = scene.moments.some((m) => m.cardId === card.id);
    const openButton = (
      <Button type="button" size="sm" variant="ghost" aria-label={`Open the card: ${truncate(label, 50)}`} title="Open the card: its note, causes, text and place" onClick={() => onOpenCard(card.id)}>
        Card
      </Button>
    );
    return (
      <div key={card.id} className="space-y-1 rounded border border-theme-subtle p-2" data-testid={`plan-${card.id}`}>
        <div className="text-sm text-content-primary">
          {isIF(card) && (
            <Badge variant="primary" size="sm">
              IF
            </Badge>
          )}{' '}
          {card.gm && (
            <Badge variant="secondary" size="sm">
              GM
            </Badge>
          )}{' '}
          {cond && <span className="text-content-secondary">If {cond}: </span>}
          {label}
        </div>
        {(showWhere || card.locationId !== scene.locationId) && (
          <div className="text-xs text-content-tertiary">
            {placeName(card.locationId)} · {slotName(card.chunkId)}
          </div>
        )}
        {card.note && <div className="text-xs text-content-secondary">GM note: {card.note}</div>}
        {card.quote && (
          <details className="text-xs">
            <summary className="cursor-pointer text-content-tertiary">Their words</summary>
            <blockquote className="mt-1 whitespace-pre-wrap text-sm text-content-primary">“{card.quote}”</blockquote>
          </details>
        )}
        {model.readOnly ? (
          <div className="flex flex-wrap items-center gap-1">
            {isWaiting(card) ? (
              <Badge variant="primary" size="sm">
                Waiting
              </Badge>
            ) : (
              (() => {
                const o = OUTCOMES.find((x) => x.value === card.outcome);
                return o && <Badge variant={o.tone} size="sm">{o.label}</Badge>;
              })()
            )}
            {openButton}
          </div>
        ) : (
        <div className="flex flex-wrap items-center gap-1">
          {isWaiting(card) ? (
            <Button type="button" size="sm" variant="secondary" title="It happens in this scene" onClick={() => onTrigger(card)}>
              Triggers here
            </Button>
          ) : (
            <div className="w-36">
              <Select
                id={`plan-${card.id}-outcome`}
                aria-label={`Outcome: ${truncate(label, 50)}`}
                selectSize="sm"
                value={card.outcome}
                onChange={(e) => onSetOutcome(card, e.target.value as Outcome)}
              >
                {OUTCOMES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <Button type="button" size="sm" variant="ghost" title="A new moment with this plan shown above it" onClick={() => onMomentFromCard(card)}>
            {used ? '+ Another moment' : '→ Moment'}
          </Button>
          {openButton}
        </div>
        )}
      </div>
    );
  };

  const person = (id: number) => {
    const c = model.cast.get(id);
    const plans = plansFor(board, scene, id);
    const stances = scene.participants.filter((o) => o !== id).flatMap((o) => {
      const s = stanceOf(board.stances, id, o);
      return s ? [{ to: o, stance: s }] : [];
    });
    if (c?.npc && !plans.here.length && !plans.waiting.length && !stances.length) return null;
    const state = model.slotIndex >= 0 ? stateAt(model.states, id, model.slotIndex) : 'active';
    return (
      <div key={id} className="space-y-2 rounded-lg border border-theme-default p-2" data-testid={`plans-${id}`}>
        <div className="flex items-center gap-2">
          <CharacterAvatar avatarUrl={c?.avatarUrl} characterName={name(id)} size="sm" />
          <span className="flex-1 font-medium text-content-primary">{name(id)}</span>
          {state !== 'active' && (
            <Badge variant={STATE_TONE[state]} size="sm">
              {STATE_LABELS[state]}
            </Badge>
          )}
        </div>
        {stances.length > 0 && (
          <ul className="space-y-0.5 text-xs">
            {stances.map(({ to, stance }) => {
              const def = STANCES.find((s) => s.value === stance.value);
              return (
                <li key={to} className="text-content-secondary">
                  → {shortName(name(to))}{' '}
                  <Badge variant={def?.tone ?? 'neutral'} size="sm">
                    {def?.label ?? stance.value}
                  </Badge>
                  {stance.note && <span className="ml-1">{stance.note}</span>}
                </li>
              );
            })}
          </ul>
        )}
        {plans.here.length ? plans.here.map((k) => row(k, false)) : <p className="text-xs text-content-tertiary">No cards in {slotName(scene.chunkId)}.</p>}
        {plans.waiting.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-content-tertiary">If… ({plans.waiting.length})</div>
            {plans.waiting.map((k) => row(k, false))}
          </div>
        )}
        {plans.other.length > 0 && (
          <details>
            <summary className="cursor-pointer text-xs text-content-tertiary">Other times ({plans.other.length})</summary>
            <div className="mt-1 space-y-1">{plans.other.map((k) => row(k, true))}</div>
          </details>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2" data-testid="scene-plans">
      {location?.notes && (
        <div className="rounded-lg border border-theme-default p-2">
          <div className="text-xs font-medium text-content-tertiary">{location.name}</div>
          <p className="whitespace-pre-wrap text-sm text-content-primary">{location.notes}</p>
        </div>
      )}
      {scene.participants.length ? scene.participants.map(person) : <p className="text-sm text-content-secondary">Nobody in this scene yet. Add people above.</p>}
      {others.length > 0 && (
        <div className="space-y-1 rounded-lg border border-theme-default p-2">
          <div className="text-xs font-medium text-content-tertiary">Also at {placeName(scene.locationId)} at this time</div>
          <div className="flex flex-wrap gap-1">
            {others.map((id) =>
              model.readOnly ? (
                <Badge key={id} variant="neutral" size="sm">
                  {shortName(name(id))}
                </Badge>
              ) : (
              <Button key={id} type="button" size="sm" variant="secondary" onClick={() => onJoin(id)} aria-label={`Add ${name(id)} to the scene`}>
                + {shortName(name(id))}
              </Button>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
