/** The game's codex: locations, NPCs, secrets and the rest, each scoped to every phase or chosen ones. */

import type { CodexEntry } from './types';

/** Whether an entry applies to this phase. An entry with no phases applies to every phase. */
export const inPhase = (entry: CodexEntry, phaseId: number) => !entry.phases.length || entry.phases.includes(phaseId);
