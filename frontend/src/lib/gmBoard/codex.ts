/** The game's codex: locations, NPCs, secrets and the rest, each scoped to every phase or chosen ones. */

import type { CodexEntry, CodexType } from './types';

/** Whether an entry applies to this phase. An entry with no phases applies to every phase. */
export const inPhase = (entry: CodexEntry, phaseId: number) => !entry.phases.length || entry.phases.includes(phaseId);

/** The phase's board rows: Location entries for this phase. */
export const phaseLocations = (codex: CodexEntry[], phaseId: number) =>
  codex.filter((e) => e.type === 'Location' && inPhase(e, phaseId));

export const CODEX_TYPES: CodexType[] = ['Location', 'NPC', 'Item', 'Faction', 'Objective', 'Secret', 'Other'];

/** A badge tone per entry: secrets stand out, locations (the board's rows) read as places. */
export const codexTone = (entry: Pick<CodexEntry, 'type' | 'secret'>) =>
  entry.secret || entry.type === 'Secret' ? 'danger' : entry.type === 'Location' ? 'success' : 'primary';

/** A new entry with empty lists. A Secret-type entry starts secret. */
export function newCodexEntry(fields: Partial<CodexEntry> & Pick<CodexEntry, 'id' | 'name'>): CodexEntry {
  const type = fields.type ?? 'Other';
  return { type, aliases: [], notes: '', secret: type === 'Secret', knownBy: [], phases: [], ...fields };
}

/** An entry as its stored item's doc: everything but the id, which is the item's key. */
export function codexDoc(entry: CodexEntry): Omit<CodexEntry, 'id'> {
  const doc: Partial<CodexEntry> = { ...entry };
  delete doc.id;
  return doc as Omit<CodexEntry, 'id'>;
}
