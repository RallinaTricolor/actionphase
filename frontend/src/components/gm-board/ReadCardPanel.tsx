import { Badge, Button, Checkbox, Combobox, Input, Select } from '@/components/ui';
import { useBoundText } from '@/hooks/useBoundText';
import { autoLabel, isIF } from '@/lib/gmBoard/cards';
import { defaultChunkId } from '@/lib/gmBoard/read';
import type { Card, Chunk, CodexEntry } from '@/lib/gmBoard/types';

interface ReadCardPanelProps {
  card: Card;
  ownerName: string;
  /** This phase's locations (the board's rows). */
  locations: CodexEntry[];
  chunks: Chunk[];
  onChange: (fields: Partial<Card>) => void;
  /** Adds a location to the codex and returns its id. */
  onCreateLocation: (name: string) => string;
  onDelete: () => void;
  onClose: () => void;
  readOnly?: boolean;
}

const WAITING = '';

/**
 * A card, open beside the submission it came from (a layout column, not a
 * modal, so the submission stays readable and selectable). In Read it sets
 * where the card goes and whether it's an IF card; the Map's card panel adds
 * outcomes, causes, notes and Split.
 */
export function ReadCardPanel({
  card,
  ownerName,
  locations,
  chunks,
  onChange,
  onCreateLocation,
  onDelete,
  onClose,
  readOnly = false,
}: ReadCardPanelProps) {
  const label = useBoundText(card.summary);
  const cond = useBoundText(card.cond);
  const ifCard = isIF(card);
  const sorted = [...chunks].sort((a, b) => a.position - b.position);
  const locationKnown = locations.some((l) => l.id === card.locationId);

  return (
    <section aria-label="Card" className="space-y-4" data-testid="read-card-panel">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-content-primary">{ownerName}</h3>
          <p className="text-sm text-content-secondary">{card.gm ? 'GM card' : 'Plan card'}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close the card">
          ✕
        </Button>
      </div>

      {card.quote && (
        <blockquote className="border-l-4 border-theme-default pl-3 text-sm text-content-primary whitespace-pre-wrap">
          {card.quote}
        </blockquote>
      )}

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
        {sorted.map((c, i) => (
          <option key={c.id} value={c.id}>
            {i + 1}. {c.name}
          </option>
        ))}
      </Select>

      <div className="space-y-2">
        <Checkbox
          id={`card-${card.id}-if`}
          label="IF card (only happens under a condition)"
          checked={ifCard}
          disabled={readOnly}
          onChange={(e) =>
            onChange(e.target.checked ? { isIF: true } : { isIF: false, cond: '', branchOf: null, chunkId: card.chunkId ?? defaultChunkId(chunks) })
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
        {ifCard && card.chunkId === null && (
          <Badge variant="primary">Waiting in Contingencies</Badge>
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
