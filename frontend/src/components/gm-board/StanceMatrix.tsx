import { useState } from 'react';
import { Badge, Button, Checkbox, Input, Select } from '@/components/ui';
import { useBoundText } from '@/hooks/useBoundText';
import type { CastMember } from '@/lib/gmBoard/cast';
import { isAmbush, STANCES, stanceKeysFor, stanceOf } from '@/lib/gmBoard/stances';
import { shortName } from '@/lib/gmBoard/text';
import type { BoardDoc, Stance, StanceValue } from '@/lib/gmBoard/types';
import { stanceLabel, stanceText } from './stanceText';

interface StanceMatrixProps {
  stances: BoardDoc['stances'];
  players: CastMember[];
  names: Map<number, string>;
  /** Starts with this player's row picked (from By character's "Stances"). */
  focusId?: number | null;
  onSet: (from: number, to: number, stance: Stance) => void;
  /** Sets every listed pair to one value ("Set several at once"). */
  onSetMany: (keys: string[], value: StanceValue | '') => void;
}

const tone = (value: string) => STANCES.find((s) => s.value === value)?.tone ?? 'neutral';

/**
 * How each player sees each other player this phase: rows are who, columns
 * toward whom. Click a cell to set it and add a note. A strike on someone
 * who thinks it's an alliance is marked.
 */
export function StanceMatrix({ stances, players, names, focusId = null, onSet, onSetMany }: StanceMatrixProps) {
  const [pair, setPair] = useState<[number, number] | null>(null);
  const strikes = players.flatMap((a) =>
    players.filter((b) => {
      const v = stanceOf(stances, a.id, b.id)?.value;
      return a.id !== b.id && (v === 'target' || v === 'ally_target');
    }).map((b) => [a.id, b.id] as const),
  );

  if (players.length < 2) return <p className="text-sm text-content-secondary">Stances need two or more players.</p>;

  return (
    <div className="space-y-6" data-testid="stance-matrix">
      <div className="overflow-x-auto" role="region" aria-label="Stances" tabIndex={0}>
        <table className="text-sm">
          <thead>
            <tr>
              <th scope="col" className="p-1 text-left text-xs font-normal text-content-tertiary">
                Who ↓ · toward →
              </th>
              {players.map((p) => (
                <th key={p.id} scope="col" className="p-1 text-left text-xs font-medium text-content-secondary">
                  {shortName(p.name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((a) => (
              <tr key={a.id} className={focusId === a.id ? 'surface-raised' : ''}>
                <th scope="row" className="p-1 pr-3 text-left font-medium text-content-primary">
                  {a.name}
                </th>
                {players.map((b) => {
                  if (a.id === b.id) return <td key={b.id} className="p-1 text-center text-content-tertiary">—</td>;
                  const s = stanceOf(stances, a.id, b.id);
                  const ambush = isAmbush(stances, a.id, b.id);
                  const picked = pair?.[0] === a.id && pair?.[1] === b.id;
                  return (
                    <td key={b.id} className="p-0.5">
                      <Button
                        type="button"
                        variant={picked ? 'secondary' : 'ghost'}
                        size="sm"
                        className="!px-1 !py-0.5 w-full !justify-start"
                        onClick={() => setPair(picked ? null : [a.id, b.id])}
                        aria-pressed={picked}
                        title={stanceText(stances, names, a.id, b.id) + (ambush ? '\nThey think it’s an alliance.' : '')}
                        aria-label={stanceText(stances, names, a.id, b.id)}
                      >
                        {s ? (
                          <Badge variant={tone(s.value)} size="sm">
                            {ambush && '⚠ '}
                            {stanceLabel(s.value)}
                            {s.note && ' ✎'}
                          </Badge>
                        ) : (
                          <span className="text-xs text-content-tertiary">·</span>
                        )}
                      </Button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pair && (
        <PairEditor
          key={pair.join('|')}
          from={pair[0]}
          to={pair[1]}
          stances={stances}
          names={names}
          onSet={(stance) => onSet(pair[0], pair[1], stance)}
          onClose={() => setPair(null)}
        />
      )}

      <SetSeveral key={focusId ?? 'none'} players={players} focusId={focusId} onSetMany={onSetMany} />

      <section className="space-y-1" aria-label="Planned strikes">
        <h3 className="text-sm font-semibold text-content-primary">Planned strikes</h3>
        {strikes.length ? (
          <ul className="space-y-0.5 text-sm text-content-primary">
            {strikes.map(([a, b]) => (
              <li key={`${a}|${b}`}>
                {stanceText(stances, names, a, b)}
                {isAmbush(stances, a, b) && <span className="text-content-secondary"> · they think it’s an alliance</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-content-secondary">Nobody is set as a Target.</p>
        )}
      </section>
    </div>
  );
}

interface PairEditorProps {
  from: number;
  to: number;
  stances: BoardDoc['stances'];
  names: Map<number, string>;
  onSet: (stance: Stance) => void;
  onClose: () => void;
}

function PairEditor({ from, to, stances, names, onSet, onClose }: PairEditorProps) {
  const current = stances[`${from}|${to}`] ?? { value: '' };
  const note = useBoundText(current.note ?? '');
  const who = `${names.get(from) ?? '?'} → ${names.get(to) ?? '?'}`;
  return (
    <section className="max-w-2xl space-y-2 rounded-lg border border-theme-default p-3" aria-label={`Stance: ${who}`}>
      <div className="flex items-center gap-2">
        <h3 className="flex-1 text-sm font-semibold text-content-primary">{who}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close the stance">
          ✕
        </Button>
      </div>
      <div className="grid grid-cols-[12rem_minmax(0,1fr)] gap-2">
        <Select id={`stance-${from}-${to}-value`} label="Stance" value={current.value} onChange={(e) => onSet({ ...current, value: e.target.value as StanceValue | '' })}>
          <option value="">Not set</option>
          {STANCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        <Input
          id={`stance-${from}-${to}-note`}
          label="Note"
          placeholder="Why, or what they want"
          value={note.text}
          {...note.bind}
          onChange={(e) => {
            note.setText(e.target.value);
            onSet({ ...current, note: e.target.value });
          }}
        />
      </div>
    </section>
  );
}

function SetSeveral({ players, focusId, onSetMany }: { players: CastMember[]; focusId: number | null; onSetMany: StanceMatrixProps['onSetMany'] }) {
  const [from, setFrom] = useState<number[]>(focusId !== null ? [focusId] : []);
  const [to, setTo] = useState<number[]>([]);
  const [value, setValue] = useState<StanceValue | ''>('neutral');
  const keys = stanceKeysFor(from, to);
  const toggle = (list: number[], id: number, on: boolean) => (on ? [...list, id] : list.filter((x) => x !== id));

  return (
    <section className="max-w-2xl space-y-2 rounded-lg border border-theme-default p-3" aria-label="Set several at once">
      <h3 className="text-sm font-semibold text-content-primary">Set several at once</h3>
      <div className="grid grid-cols-2 gap-4">
        <fieldset className="space-y-1">
          <legend className="text-xs text-content-secondary">Who</legend>
          {players.map((p) => (
            <Checkbox key={p.id} id={`several-from-${p.id}`} label={p.name} checked={from.includes(p.id)} onChange={(e) => setFrom(toggle(from, p.id, e.target.checked))} />
          ))}
        </fieldset>
        <fieldset className="space-y-1">
          <legend className="text-xs text-content-secondary">Toward</legend>
          {players.map((p) => (
            <Checkbox key={p.id} id={`several-to-${p.id}`} label={p.name} checked={to.includes(p.id)} onChange={(e) => setTo(toggle(to, p.id, e.target.checked))} />
          ))}
        </fieldset>
      </div>
      <div className="flex items-end gap-2">
        <div className="w-56">
          <Select id="several-value" label="Stance" value={value} onChange={(e) => setValue(e.target.value as StanceValue | '')}>
            <option value="">Not set</option>
            {STANCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        <Button type="button" variant="primary" disabled={!keys.length} onClick={() => onSetMany(keys, value)}>
          Set {keys.length} stance{keys.length === 1 ? '' : 's'}
        </Button>
      </div>
    </section>
  );
}
