import { Button, Card, CardBody, Checkbox } from '@/components/ui';
import { formatNumber, numberOf, tabByRef, findEntry, fieldByRef, mainNumberField } from '@/lib/gmBoard/rewards';
import { scaleLabel } from '@/lib/gmBoard/template';
import { truncate } from '@/lib/gmBoard/text';
import type { RewardState } from '@/lib/gmBoard/rewardState';
import { useBoardRewards } from './boardRewards';

interface RewardsTableProps {
  /** Who gets a result, in Write's order. */
  characterIds: number[];
  name: (characterId: number) => string;
  stateFor: (characterId: number) => RewardState;
  onOpen: (characterId: number) => void;
  onBack: () => void;
}

/**
 * Characters × reward list items: tick a box to give that reward. With each
 * scale's value (the main track total), the open reward checks and how many
 * sheet changes each character's rewards make.
 */
export function RewardsTable({ characterIds, name, stateFor, onOpen, onBack }: RewardsTableProps) {
  const rewards = useBoardRewards();
  const { items, scales, layout } = rewards;

  const scaleCell = (state: RewardState, ref: string) => {
    const parts = ref.split('/').map((p) => p.trim());
    const tab = tabByRef(layout, parts[0] ?? '');
    const entryName = parts.slice(1, parts.length > 2 ? -1 : undefined).join('/');
    if (!tab || !entryName) return '—';
    const field = parts.length > 2 ? (fieldByRef(tab, parts[parts.length - 1])?.key ?? '') : mainNumberField(tab);
    const after = findEntry(state.sheet.after[tab.key] ?? [], entryName);
    if (!after) return '—';
    const n = numberOf(after, field);
    const gain = n - numberOf(findEntry(state.sheet.before[tab.key] ?? [], entryName), field);
    return (
      <>
        <strong>{formatNumber(n)}</strong>
        {gain !== 0 && <span className="text-content-tertiary"> ({gain > 0 ? '+' : ''}{formatNumber(gain)})</span>}
        <div className="text-content-tertiary">{scaleLabel(scales, ref, n)}</div>
      </>
    );
  };

  return (
    <Card variant="bordered" padding="md" data-testid="rewards-table">
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-content-primary">Rewards table</h3>
          <Button type="button" size="sm" variant="secondary" onClick={onBack}>
            ← Results
          </Button>
        </div>
        <p className="text-sm text-content-secondary">
          Tick a box to give that reward: the same text and sheet change go into that character’s rewards. Numbers are what the block will say, worked out from the sheet.
        </p>
        {items.length === 0 ? (
          <p className="text-sm text-content-secondary">No rewards in the lists yet. Add them on Game setup.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-theme-default text-left align-bottom">
                  <th className="px-2 py-1 font-semibold text-content-primary">Character</th>
                  {scales.map((s) => (
                    <th key={s.name} className="px-2 py-1 font-semibold text-content-primary">
                      {s.name.split('/').pop()}
                    </th>
                  ))}
                  <th className="px-2 py-1 font-semibold text-content-primary">Sheet changes</th>
                  <th className="px-2 py-1 font-semibold text-content-primary">Checks</th>
                  {items.map((i) => (
                    <th key={i.id} className={`px-2 py-1 font-semibold text-content-primary ${i.scope === 'game' ? 'surface-sunken' : ''}`} title={truncate(i.text, 200)}>
                      {i.name || 'Unnamed'}
                      <div className="text-xs font-normal text-content-tertiary">
                        {i.scope === 'game' ? 'every phase' : 'this phase'}
                        {i.choose ? ' · choose' : ''}
                      </div>
                    </th>
                  ))}
                  <th className="px-2 py-1 font-semibold text-content-primary">Other lines</th>
                </tr>
              </thead>
              <tbody>
                {characterIds.map((id) => {
                  const state = stateFor(id);
                  return (
                    <tr key={id} className="border-b border-theme-default" data-testid={`rewards-row-${id}`}>
                      <td className="px-2 py-1">
                        <Button type="button" size="sm" variant="ghost" onClick={() => onOpen(id)}>
                          {name(id)}
                        </Button>
                      </td>
                      {scales.map((s) => (
                        <td key={s.name} className="px-2 py-1">
                          {scaleCell(state, s.name)}
                        </td>
                      ))}
                      <td className="px-2 py-1 text-content-secondary">{state.changes || '—'}</td>
                      <td className="px-2 py-1 text-content-secondary">{state.checks.length || '—'}</td>
                      {items.map((i) => (
                        <td key={i.id} className={`px-2 py-1 text-center ${i.scope === 'game' ? 'surface-sunken' : ''}`}>
                          <Checkbox
                            aria-label={`${i.name} for ${name(id)}`}
                            checked={state.lines.some((l) => l.itemId === i.id)}
                            disabled={state.locked || rewards.readOnly}
                            onChange={() => rewards.toggleItem(id, i)}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1 text-content-secondary">{state.lines.filter((l) => !l.itemId).length || ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
