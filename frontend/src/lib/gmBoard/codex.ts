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

/**
 * The phases a new entry starts with. Most games have different places (and
 * objectives) each phase, so those start as one phase's; NPCs, items, factions
 * and secrets usually carry on, so they start as every phase's. With no phase
 * to give, it's every phase.
 */
export const defaultPhases = (type: CodexType, phaseId: number | undefined): number[] =>
  phaseId !== undefined && (type === 'Location' || type === 'Objective') ? [phaseId] : [];

/** A new location for one phase: what any "add a location" on a board makes. */
export const newLocation = (id: string, name: string, phaseId: number): CodexEntry =>
  newCodexEntry({ id, type: 'Location', name, phases: [phaseId] });

/** The entry with this phase added to it. An every-phase entry already has it. */
export const withPhase = (entry: CodexEntry, phaseId: number): CodexEntry =>
  inPhase(entry, phaseId) ? entry : { ...entry, phases: [...entry.phases, phaseId] };

/**
 * Other phases' locations that aren't on this phase's Map, by phase, in the
 * order given (an entry for several phases is listed under each). Phases with
 * none are left out.
 */
export function otherPhaseLocations(codex: CodexEntry[], phases: readonly { id: number; title: string }[], phaseId: number) {
  const missing = codex.filter((e) => e.type === 'Location' && !inPhase(e, phaseId));
  return phases
    .filter((p) => p.id !== phaseId)
    .map((p) => ({ phase: p, entries: missing.filter((e) => e.phases.includes(p.id)) }))
    .filter((g) => g.entries.length > 0);
}
