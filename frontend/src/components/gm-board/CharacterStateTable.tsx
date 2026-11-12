import { useState } from 'react';
import { Badge, Button } from '@/components/ui';
import { stateAt } from '@/lib/gmBoard/states';
import { isShown, STATE_LABELS, STATE_TONE } from './mapModel';
import type { MapModel } from './mapTypes';

/**
 * Each player's state in each time slot, set by scene effects (with none,
 * everyone is active). Starts open, under the grid.
 */
export function CharacterStateTable({ model }: { model: MapModel }) {
  const [open, setOpen] = useState(true);
  const players = [...model.cast.values()].filter((c) => !c.npc && isShown(model, c.id));
  return (
    <section aria-label="Character state over the phase" className="rounded-lg border border-theme-default surface-base">
      <Button type="button" variant="ghost" size="sm" className="w-full !justify-start" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? '▾' : '▸'} Character state over the phase
      </Button>
      {open && (
        <div className="overflow-x-auto px-2 pb-2">
          <table className="text-sm">
            <thead>
              <tr>
                <th scope="col" className="p-1 text-left text-xs font-normal text-content-tertiary">
                  Character
                </th>
                {model.slots.map((s) => (
                  <th key={s.id} scope="col" className="p-1 text-left text-xs font-normal text-content-tertiary">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id}>
                  <th scope="row" className="p-1 pr-4 text-left font-medium text-content-primary">
                    {p.name}
                  </th>
                  {model.slots.map((s, i) => {
                    const state = stateAt(model.states, p.id, i);
                    return (
                      <td key={s.id} className="p-1">
                        {state === 'active' ? (
                          <span className="text-xs text-content-tertiary">Active</span>
                        ) : (
                          <Badge variant={STATE_TONE[state]} size="sm">
                            {STATE_LABELS[state]}
                          </Badge>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
