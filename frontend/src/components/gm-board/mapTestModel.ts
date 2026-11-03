import { makeBoard, makeCodexEntry } from '@/test-utils/factories';
import type { CastMember } from '@/lib/gmBoard/cast';
import type { BoardDoc } from '@/lib/gmBoard/types';
import { buildMapModel } from './mapModel';
import type { DragState, MapActions } from './mapTypes';
import { vi } from 'vitest';

// Hand-written test data for the Map's tests; never player content.
const PHASE = 70;
const CODEX = [
  makeCodexEntry({ id: 'mill', name: 'the Old Mill', type: 'Location' }),
  makeCodexEntry({ id: 'dock', name: 'dock', type: 'Location' }),
  makeCodexEntry({ id: 'tower', name: 'the Tower', type: 'Location', phases: [69] }),
];
export const CAST: CastMember[] = [
  { id: 1, name: 'Harrison Vale', npc: false },
  { id: 2, name: 'Mara Quill', npc: false },
  { id: 3, name: 'Ilse', npc: false },
  { id: 9, name: 'Bo Hale', npc: true },
];

export function testModel(board: Partial<BoardDoc> = {}, opts: { visible?: number[] | null; resolving?: string | null; submitters?: number[] } = {}) {
  const names = new Map(CAST.map((c) => [c.id, c.name]));
  return buildMapModel({
    board: makeBoard(board),
    codex: CODEX,
    phaseId: PHASE,
    cast: CAST,
    names,
    nameLists: new Map(CAST.map((c) => [c.id, [c.name, c.name.split(' ')[0]]])),
    submitters: opts.submitters ?? [1, 2, 3],
    visible: opts.visible ?? null,
    resolving: opts.resolving ?? null,
  });
}

export function testActions(): MapActions {
  return {
    openCard: vi.fn(),
    addGmCards: vi.fn(),
    moveCard: vi.fn(),
    renameSlot: vi.fn(),
    insertSlotBefore: vi.fn(),
    removeSlot: vi.fn(),
    resolveAt: vi.fn(),
    readSubmission: vi.fn(),
    openStances: vi.fn(),
  };
}

export const noDrag = (cardId: string | null = null): DragState => ({ cardId, start: vi.fn(), end: vi.fn() });
