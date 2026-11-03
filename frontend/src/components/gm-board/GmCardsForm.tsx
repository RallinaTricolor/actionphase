import { useState } from 'react';
import { Button, Checkbox, Combobox, Select, Textarea } from '@/components/ui';
import type { CastMember } from '@/lib/gmBoard/cast';
import type { Chunk } from '@/lib/gmBoard/types';

export interface GmCardsRequest {
  characterIds: number[];
  locationId: string;
  chunkId: string;
  summary: string;
}

interface GmCardsFormProps {
  cast: CastMember[];
  locations: { id: string; name: string }[];
  slots: Chunk[];
  prefill: { characterIds?: number[]; locationId?: string; chunkId?: string };
  /** Adds a location to the codex and returns its id. */
  onCreateLocation: (name: string) => string;
  onSubmit: (request: GmCardsRequest) => void;
  onCancel: () => void;
}

/**
 * "+ GM cards": one card for each person picked, all in one cell, with the
 * same text. For things nobody submitted: a patrol, a storm, an NPC's move.
 */
export function GmCardsForm({ cast, locations, slots, prefill, onCreateLocation, onSubmit, onCancel }: GmCardsFormProps) {
  const [who, setWho] = useState<number[]>(prefill.characterIds ?? []);
  const [locationId, setLocationId] = useState<string | null>(prefill.locationId ?? null);
  const [chunkId, setChunkId] = useState(prefill.chunkId ?? slots[0]?.id ?? '');
  const [summary, setSummary] = useState('');
  const ready = who.length > 0 && !!locationId && !!chunkId;
  const players = cast.filter((c) => !c.npc);
  const npcs = cast.filter((c) => c.npc);

  const person = (c: CastMember) => (
    <Checkbox
      key={c.id}
      id={`gm-cards-who-${c.id}`}
      label={c.name}
      checked={who.includes(c.id)}
      onChange={(e) => setWho(e.target.checked ? [...who, c.id] : who.filter((x) => x !== c.id))}
    />
  );

  return (
    <form
      className="space-y-4 p-4"
      data-testid="gm-cards-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit({ characterIds: who, locationId: locationId as string, chunkId, summary: summary.trim() });
      }}
    >
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-content-primary">Who</legend>
        <div className="grid grid-cols-2 gap-1">{players.map(person)}</div>
        {npcs.length > 0 && (
          <>
            <div className="pt-2 text-xs text-content-tertiary">NPCs</div>
            <div className="grid grid-cols-2 gap-1">{npcs.map(person)}</div>
          </>
        )}
      </fieldset>

      <Combobox
        label="Location"
        options={locations.map((l) => ({ value: l.id, label: l.name }))}
        value={locationId}
        onChange={setLocationId}
        onCreate={(name) => setLocationId(onCreateLocation(name))}
        createLabel={(name) => `Add “${name}” to the codex`}
        data-testid="gm-cards-location"
      />

      <Select id="gm-cards-slot" label="Time slot" value={chunkId} onChange={(e) => setChunkId(e.target.value)}>
        {slots.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>

      <Textarea
        id="gm-cards-summary"
        label="What happens"
        rows={3}
        placeholder="e.g. The night watch passes through"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
      />

      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={!ready}>
          {who.length > 1 ? `Add ${who.length} cards` : 'Add card'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
