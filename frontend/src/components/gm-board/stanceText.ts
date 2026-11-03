import { STANCES, stanceOf } from '@/lib/gmBoard/stances';
import { shortName } from '@/lib/gmBoard/text';
import type { BoardDoc } from '@/lib/gmBoard/types';

export const stanceLabel = (value: string) => STANCES.find((s) => s.value === value)?.label ?? 'Not set';

/** "Mara → Ilse: Wary — owes her money", or "…: not set". */
export function stanceText(stances: BoardDoc['stances'], names: Map<number, string>, from: number, to: number): string {
  const s = stanceOf(stances, from, to);
  const who = `${shortName(names.get(from) ?? '?')} → ${shortName(names.get(to) ?? '?')}`;
  return s ? `${who}: ${stanceLabel(s.value)}${s.note ? ` — ${s.note}` : ''}` : `${who}: not set`;
}
