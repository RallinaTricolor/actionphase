import { useMemo } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { cardDoc, splitCard } from '@/lib/gmBoard/cards';
import { cardsCiting, nextSlotName, pushLater } from '@/lib/gmBoard/map';
import { newItemKey } from '@/lib/gmBoard/store';
import type { BoardDoc, Card } from '@/lib/gmBoard/types';
import { useGmBoardStore } from './useGmBoard';

type Doc = Omit<Card, 'id'>;

/**
 * Edits to cards that Read and the Map share. Deleting, splitting and Push
 * later touch several items, so each shows an Undo toast that puts every one
 * of them back.
 */
export function useBoardCardActions(gameId: number, phaseId: number, board: BoardDoc, names: Map<number, string>) {
  const store = useGmBoardStore(gameId, phaseId);
  const { showToast } = useToast();

  return useMemo(() => {
    const put = (card: Card) => store.update<Doc>('card', card.id, () => cardDoc(card));
    const chunkName = (id: string | null) => board.chunks.find((c) => c.id === id)?.name ?? 'Contingencies';

    return {
      change: (card: Card, fields: Partial<Card>) =>
        store.update<Doc>('card', card.id, (current) => ({ ...(current ?? cardDoc(card)), ...fields })),

      /** Deletes a card and takes it out of other cards' causes. */
      remove: (card: Card) => {
        const citing = cardsCiting(board.cards, card.id);
        const before = board.cards.filter((c) => citing.some((x) => x.id === c.id));
        store.remove('card', card.id);
        citing.forEach(put);
        showToast('Card deleted.', 'info', {
          action: {
            label: 'Undo',
            onClick: () => {
              put(card);
              before.forEach(put);
            },
          },
        });
      },

      /** Splits a card at a cursor position. Returns false when the cursor is at either end. */
      split: (card: Card, at: number): boolean => {
        const result = splitCard(card, at, board.chunks, newItemKey('card'));
        if (!result) return false;
        put(result.kept);
        put(result.added);
        showToast(`Card split. The second part is in ${chunkName(result.added.chunkId)}.`, 'success', {
          action: {
            label: 'Undo',
            onClick: () => {
              store.remove('card', result.added.id);
              put(card);
            },
          },
        });
        return true;
      },

      /** Moves the character's later cards one time slot later, adding a slot at the end if needed. */
      pushLater: (card: Card) => {
        const added = { id: newItemKey('slot'), name: nextSlotName(board.chunks) };
        const result = pushLater(board, card.id, added);
        if (!result) return;
        const moved = result.moves.map((m) => board.cards.find((c) => c.id === m.cardId) as Card);
        if (result.addedChunk) {
          const { name, position } = result.addedChunk;
          store.update('chunk', added.id, () => ({ name, position }));
        }
        result.moves.forEach((m, i) => put({ ...moved[i], chunkId: m.chunkId }));
        const who = names.get(card.characterId) ?? 'Their';
        const n = moved.length;
        showToast(`Moved ${who}’s ${n} later card${n === 1 ? '' : 's'} one slot.`, 'info', {
          action: {
            label: 'Undo',
            onClick: () => {
              moved.forEach(put);
              if (result.addedChunk) store.remove('chunk', added.id);
            },
          },
        });
      },
    };
  }, [store, board, names, showToast]);
}
