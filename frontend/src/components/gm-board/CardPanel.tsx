import { useRef, useState } from 'react';
import { Badge, Button, Checkbox, Combobox, Input, Select, Textarea } from '@/components/ui';
import { useBoundText } from '@/hooks/useBoundText';
import { autoLabel, cardLabel, isIF, isWaiting, needsCause, OUTCOMES, textField } from '@/lib/gmBoard/cards';
import type { CastMember } from '@/lib/gmBoard/cast';
import { causeCandidates, laterCardCount, sortedChunks, type CauseGroup } from '@/lib/gmBoard/map';
import { defaultChunkId } from '@/lib/gmBoard/read';
import { shortName, truncate } from '@/lib/gmBoard/text';
import type { BoardDoc, Card } from '@/lib/gmBoard/types';

interface CardPanelProps {
  card: Card;
  board: BoardDoc;
  /** characterId → name. */
  names: Map<number, string>;
  /** Locations a card can be placed in (the board's rows). */
  locations: { id: string; name: string }[];
  /** Who a GM card can belong to. */
  cast?: CastMember[];
  onChange: (fields: Partial<Card>) => void;
  /** Adds a location to the codex and returns its id. */
  onCreateLocation: (name: string) => string;
  /** Splits the card at a cursor position; false when the cursor is at either end. */
  onSplit: (at: number) => boolean;
  onPushLater: () => void;
  onDelete: () => void;
  onClose: () => void;
  /** Opens the card's submission in Read (not shown in Read itself). */
  onReadSubmission?: () => void;
  readOnly?: boolean;
}

const WAITING = '';

/**
 * A card, open in a column beside the submission (Read) or the board (Map),
 * never a modal, so what's behind it stays usable. Everything about a card is
 * here: its text (the board's copy; the submission doesn't change), outcome
 * and causes, note, place and time, IF condition, Split and Push later.
 */
export function CardPanel({
  card,
  board,
  names,
  locations,
  cast,
  onChange,
  onCreateLocation,
  onSplit,
  onPushLater,
  onDelete,
  onClose,
  onReadSubmission,
  readOnly = false,
}: CardPanelProps) {
  // Fixed while the panel is open, so clearing a quote doesn't swap the box to the label.
  const [field] = useState(() => textField(card));
  const text = useBoundText(card[field]);
  const label = useBoundText(card.summary);
  const note = useBoundText(card.note);
  const cond = useBoundText(card.cond);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [splitHint, setSplitHint] = useState(false);

  const ifCard = isIF(card);
  const waiting = isWaiting(card);
  const slots = sortedChunks(board.chunks);
  const slotName = (id: string | null) => board.chunks.find((c) => c.id === id)?.name ?? '';
  const locationKnown = locations.some((l) => l.id === card.locationId);
  const later = laterCardCount(board, card);
  const owner = names.get(card.characterId) ?? `Character ${card.characterId}`;
  const short = shortName(owner);
  const causes = !waiting && (needsCause(card.outcome) || card.causedBy.length > 0) ? causeCandidates(board, card) : null;

  const causeLabel = (id: string, scene: boolean) => {
    if (scene) return `Scene: ${truncate(board.scenes.find((s) => s.id === id)?.title || 'untitled', 40)}`;
    const c = board.cards.find((x) => x.id === id);
    return c ? `${shortName(names.get(c.characterId) ?? '?')}: ${truncate(cardLabel(c), 40)}` : '?';
  };
  const groupTitle = (g: CauseGroup) =>
    g.kind === 'same' ? 'Same place and time' : g.kind === 'elsewhere' ? `Elsewhere in ${slotName(g.chunkId)}` : g.kind === 'before' ? `${slotName(g.chunkId)} (before)` : 'Chosen earlier';
  const toggleCause = (id: string) =>
    onChange({ causedBy: card.causedBy.includes(id) ? card.causedBy.filter((x) => x !== id) : [...card.causedBy, id] });

  const split = () => {
    const at = textRef.current?.selectionStart ?? 0;
    setSplitHint(!onSplit(at));
  };

  return (
    <section aria-label="Card" className="space-y-4" data-testid="card-panel">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-content-primary">{owner}</h3>
          <p className="text-sm text-content-secondary">{card.gm ? 'GM card' : 'Plan card'}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close the card">
          ✕
        </Button>
      </div>

      {card.gm && cast && (
        <Select
          id={`card-${card.id}-who`}
          label="Whose card"
          value={card.characterId}
          disabled={readOnly}
          onChange={(e) => onChange({ characterId: Number(e.target.value) })}
        >
          {cast.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.npc ? ' (NPC)' : ''}
            </option>
          ))}
        </Select>
      )}

      <div className="space-y-1">
        <Textarea
          ref={textRef}
          id={`card-${card.id}-text`}
          label={field === 'quote' ? 'From the submission' : 'What happens'}
          helperText={field === 'quote' ? 'The board’s copy: editing it doesn’t change the submission.' : undefined}
          rows={field === 'quote' ? 5 : 2}
          placeholder={field === 'summary' ? 'e.g. Stuck in the cellar an extra slot' : undefined}
          value={text.text}
          readOnly={readOnly}
          {...text.bind}
          onChange={(e) => {
            text.setText(e.target.value);
            setSplitHint(false);
            onChange({ [field]: e.target.value });
          }}
        />
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={split}>
              Split at the cursor
            </Button>
            {onReadSubmission && (
              <Button type="button" size="sm" variant="ghost" onClick={onReadSubmission}>
                Read the submission
              </Button>
            )}
          </div>
        )}
        {splitHint && (
          <p className="text-sm text-content-secondary" role="status">
            Put the cursor in the text where the second card should start.
          </p>
        )}
      </div>

      {card.quote && (
        <Input
          id={`card-${card.id}-label`}
          label="Label on the board"
          optional
          placeholder={autoLabel(card.quote)}
          value={label.text}
          readOnly={readOnly}
          {...label.bind}
          onChange={(e) => {
            label.setText(e.target.value);
            onChange({ summary: e.target.value });
          }}
        />
      )}

      {waiting ? (
        <div className="space-y-1">
          <Badge variant="primary">Waiting in Contingencies</Badge>
          <p className="text-sm text-content-secondary">
            When it triggers, pick its time slot below or drag it onto the board, then set its outcome. If it never triggers, it counts as moot.
          </p>
        </div>
      ) : (
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium text-content-primary">Outcome</legend>
          <div className="flex flex-wrap gap-1">
            {OUTCOMES.map((o) => (
              <Button
                key={o.value}
                type="button"
                size="sm"
                variant={card.outcome === o.value ? 'primary' : 'outline'}
                aria-pressed={card.outcome === o.value}
                disabled={readOnly}
                onClick={() => onChange({ outcome: o.value })}
              >
                {o.label}
              </Button>
            ))}
          </div>
        </fieldset>
      )}

      {causes && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-content-primary">
            Because of… <span className="font-normal text-content-tertiary">(optional)</span>
          </legend>
          {causes.length === 0 ? (
            <p className="text-sm text-content-tertiary">Nothing nearby on the board.</p>
          ) : (
            causes.map((g) => (
              <div key={g.kind}>
                <p className="text-xs text-content-tertiary mb-1">{groupTitle(g)}</p>
                <div className="flex flex-wrap gap-1">
                  {g.items.map((x) => (
                    <Button
                      key={x.id}
                      type="button"
                      size="sm"
                      variant={card.causedBy.includes(x.id) ? 'secondary' : 'ghost'}
                      aria-pressed={card.causedBy.includes(x.id)}
                      disabled={readOnly}
                      onClick={() => toggleCause(x.id)}
                    >
                      {causeLabel(x.id, x.scene)}
                    </Button>
                  ))}
                </div>
              </div>
            ))
          )}
        </fieldset>
      )}

      <Textarea
        id={`card-${card.id}-note`}
        label="GM note"
        helperText="Private. Shows in the writing brief."
        rows={2}
        placeholder="What actually happened, why, what to mention"
        value={note.text}
        readOnly={readOnly}
        {...note.bind}
        onChange={(e) => {
          note.setText(e.target.value);
          onChange({ note: e.target.value });
        }}
      />

      <Combobox
        label="Location"
        options={locations.map((l) => ({ value: l.id, label: l.name }))}
        value={locationKnown ? card.locationId : null}
        onChange={(locationId) => onChange({ locationId })}
        onCreate={readOnly ? undefined : (name) => onChange({ locationId: onCreateLocation(name) })}
        createLabel={(name) => `Add “${name}” to the codex`}
        error={locationKnown ? undefined : 'No location: pick one.'}
        disabled={readOnly}
        data-testid="card-location"
      />

      <Select
        id={`card-${card.id}-chunk`}
        label="Time slot"
        value={card.chunkId ?? WAITING}
        disabled={readOnly}
        onChange={(e) => onChange({ chunkId: e.target.value === WAITING ? null : e.target.value })}
      >
        {ifCard && <option value={WAITING}>Contingencies (hasn’t triggered)</option>}
        {slots.map((c, i) => (
          <option key={c.id} value={c.id}>
            {i + 1}. {c.name}
          </option>
        ))}
      </Select>

      {!waiting && !readOnly && (
        <div className="space-y-1">
          <Button type="button" size="sm" variant="secondary" disabled={!later} onClick={onPushLater}>
            Push {short}’s later cards →
          </Button>
          <p className="text-xs text-content-tertiary">
            {later
              ? `Delayed here? ${later} card${later === 1 ? '' : 's'} after ${slotName(card.chunkId)} move one slot later; this one stays.`
              : `No cards after ${slotName(card.chunkId)}.`}
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Checkbox
          id={`card-${card.id}-if`}
          label="IF card (only happens under a condition)"
          checked={ifCard}
          disabled={readOnly}
          onChange={(e) =>
            onChange(e.target.checked ? { isIF: true } : { isIF: false, cond: '', branchOf: null, chunkId: card.chunkId ?? defaultChunkId(board.chunks) })
          }
        />
        {ifCard && (
          <Input
            id={`card-${card.id}-cond`}
            label="Condition"
            placeholder="caught in a trap, someone ahead of her…"
            value={cond.text}
            readOnly={readOnly}
            {...cond.bind}
            onChange={(e) => {
              cond.setText(e.target.value);
              onChange({ cond: e.target.value });
            }}
          />
        )}
      </div>

      {!readOnly && (
        <div className="flex justify-end">
          <Button type="button" variant="danger" size="sm" onClick={onDelete}>
            Delete card
          </Button>
        </div>
      )}
    </section>
  );
}
