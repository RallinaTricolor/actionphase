import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { ToastProvider } from '@/contexts/ToastContext';
import { makeAxiosResponse, makeGmItem } from '@/test-utils/factories';
import type { GmItem } from '@/types/gmBoard';
import { useBoardCardActions } from './useBoardCardActions';
import { useGmBoard } from './useGmBoard';
import { assembleBoard } from '../lib/gmBoard/store';
import { apiClient } from '../lib/api';

vi.mock('../lib/api', () => ({
  apiClient: { gmBoard: { getBoard: vi.fn(), applyBoardChanges: vi.fn() } },
}));
const api = vi.mocked(apiClient.gmBoard);
const EMPTY = assembleBoard([]);

// Hand-written test data.
const chunk = (key: string, name: string, position: number) => makeGmItem({ kind: 'chunk', key, doc: { name, position } });
const card = (key: string, doc: Record<string, unknown>) =>
  makeGmItem({
    kind: 'card',
    key,
    doc: { quote: '', summary: '', note: '', locationId: 'hall', chunkId: 'k1', outcome: 'pending', causedBy: [], isIF: false, cond: '', branchOf: null, src: [], gm: false, ...doc },
  });

function setup(items: GmItem[]) {
  api.getBoard.mockResolvedValue(makeAxiosResponse({ items, cursor: 5 }));
  api.applyBoardChanges.mockImplementation(() => new Promise(() => {}));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
  const names = new Map([[1, 'Mara']]);
  return renderHook(
    () => {
      const { board } = useGmBoard(7, 70);
      const actions = useBoardCardActions(7, 70, board ?? EMPTY, names);
      return { board, actions };
    },
    { wrapper },
  );
}

const byId = <T extends { id: string }>(cards: T[] | undefined, id: string) => cards?.find((c) => c.id === id);
const undo = () => act(() => screen.getByRole('button', { name: 'Undo' }).click());

describe('useBoardCardActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes a card, takes it out of other cards’ causes, and Undo puts both back', async () => {
    const { result } = setup([chunk('k1', 'Pre', 1), card('a', { characterId: 1 }), card('b', { characterId: 2, causedBy: ['a', 'x'] })]);
    await waitFor(() => expect(result.current.board).toBeDefined());
    act(() => result.current.actions.remove(byId(result.current.board!.cards, 'a') as never));
    expect(byId(result.current.board!.cards, 'a')).toBeUndefined();
    expect(byId(result.current.board!.cards, 'b')).toMatchObject({ causedBy: ['x'] });
    undo();
    expect(byId(result.current.board!.cards, 'a')).toBeDefined();
    expect(byId(result.current.board!.cards, 'b')).toMatchObject({ causedBy: ['a', 'x'] });
  });

  it('splits a card into the next slot, refuses a split at either end, and Undo joins it again', async () => {
    const { result } = setup([chunk('k1', 'Pre', 1), chunk('k2', 'Slot 1', 2), card('a', { characterId: 1, quote: 'Plant the sword. Launch.' })]);
    await waitFor(() => expect(result.current.board).toBeDefined());
    const original = byId(result.current.board!.cards, 'a') as never;
    expect(result.current.actions.split(original, 0)).toBe(false);
    let ok = false;
    act(() => {
      ok = result.current.actions.split(original, 17);
    });
    expect(ok).toBe(true);
    expect(result.current.board!.cards.map((c) => [c.quote, c.chunkId])).toEqual(
      expect.arrayContaining([['Plant the sword.', 'k1'], ['Launch.', 'k2']]),
    );
    expect(screen.getByText('Card split. The second part is in Slot 1.')).toBeInTheDocument();
    undo();
    expect(result.current.board!.cards.map((c) => c.quote)).toEqual(['Plant the sword. Launch.']);
  });

  it('pushes later cards back a slot, adding one at the end, and Undo removes it again', async () => {
    const { result } = setup([
      chunk('k1', 'Pre', 1),
      chunk('k2', 'Slot 1', 2),
      card('a', { characterId: 1, chunkId: 'k1' }),
      card('b', { characterId: 1, chunkId: 'k2' }),
    ]);
    await waitFor(() => expect(result.current.board).toBeDefined());
    act(() => result.current.actions.pushLater(byId(result.current.board!.cards, 'a') as never));
    const board = result.current.board!;
    expect(board.chunks.map((c) => c.name)).toEqual(['Pre', 'Slot 1', 'Slot 2']);
    expect(byId(board.cards, 'b')?.chunkId).toBe(board.chunks[2].id);
    expect(screen.getByText('Moved Mara’s 1 later card one slot.')).toBeInTheDocument();
    undo();
    expect(result.current.board!.chunks.map((c) => c.name)).toEqual(['Pre', 'Slot 1']);
    expect(byId(result.current.board!.cards, 'b')?.chunkId).toBe('k2');
  });
});
