import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, CardBody, Spinner } from '@/components/ui';
import { useGameContext } from '@/contexts/GameContext';
import { useToast } from '@/contexts/ToastContext';
import { useGameCharacterSheetItems } from '@/hooks/useCharacterSheetItems';
import { useGmBoardStore, useGmSettings, useGmSettingsStore } from '@/hooks/useGmBoard';
import { apiClient } from '@/lib/api';
import { cardDoc, newCard } from '@/lib/gmBoard/cards';
import { boardCast } from '@/lib/gmBoard/cast';
import { codexDoc, inPhase, newCodexEntry, phaseLocations } from '@/lib/gmBoard/codex';
import { nextNotDone, setReadDone } from '@/lib/gmBoard/progress';
import { DEFAULT_CHUNKS, guessCondition, placeNewCard, submissionLinks, type NamedCharacter } from '@/lib/gmBoard/read';
import { stanceKey } from '@/lib/gmBoard/stances';
import { newItemKey } from '@/lib/gmBoard/store';
import { characterNames } from '@/lib/gmBoard/text';
import type { BoardDoc, Card as BoardCard, CharacterProgress, Chunk, Stance } from '@/lib/gmBoard/types';
import type { GamePhase } from '@/types/phases';
import { ReadCardPanel } from './ReadCardPanel';
import { ReadPlayerList } from './ReadPlayerList';
import { ReadSidebar } from './ReadSidebar';
import { SubmissionReader, type NewCardRequest } from './SubmissionReader';

interface GmBoardReadProps {
  gameId: number;
  phase: GamePhase;
  board: BoardDoc;
  /** Opens the board's codex drawer, with a name to start from. */
  onOpenCodex: (name?: string) => void;
  onGoToMap: () => void;
}

type BoardStore = ReturnType<typeof useGmBoardStore>;

/**
 * The Read step: one player's submission at a time, turned into plan cards.
 * Columns: who submitted, the submission, then either the sidebar (stances,
 * cards, who it connects to) or the card being edited. The reader is in the
 * URL (`?who=`), so a reload stays on the same submission.
 */
export function GmBoardRead({ gameId, phase, board, onOpenCodex, onGoToMap }: GmBoardReadProps) {
  const [params, setParams] = useSearchParams();
  const { allGameCharacters } = useGameContext();
  const { showToast } = useToast();
  const store: BoardStore = useGmBoardStore(gameId, phase.id);
  const settingsStore = useGmSettingsStore(gameId);
  const { settings } = useGmSettings(gameId);
  const sheetItems = useGameCharacterSheetItems(gameId);
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  const actions = useQuery({
    queryKey: ['gameActions', gameId],
    queryFn: () => apiClient.phases.getGameActions(gameId).then((res) => res.data),
    enabled: gameId > 0,
  });

  const cast = useMemo(() => boardCast(allGameCharacters), [allGameCharacters]);
  const names = useMemo(() => {
    const m = new Map(cast.map((c) => [c.id, c.name]));
    for (const a of actions.data ?? []) if (a.character_id && !m.has(a.character_id)) m.set(a.character_id, a.character_name ?? `Character ${a.character_id}`);
    return m;
  }, [cast, actions.data]);

  const phaseActions = useMemo(() => (actions.data ?? []).filter((a) => a.phase_id === phase.id), [actions.data, phase.id]);
  const submissions = useMemo(() => {
    const rank = new Map(cast.map((c, i) => [c.id, i]));
    return phaseActions
      .filter((a): a is typeof a & { character_id: number } => typeof a.character_id === 'number')
      .map((a) => ({ characterId: a.character_id, text: a.content }))
      .sort((a, b) => (rank.get(a.characterId) ?? 1e9) - (rank.get(b.characterId) ?? 1e9));
  }, [phaseActions, cast]);
  const noCharacter = phaseActions.length - submissions.length;

  const characters = useMemo<NamedCharacter[]>(
    () => [...names].map(([id, name]) => ({ id, names: characterNames(settings?.names ?? {}, id, name) })),
    [names, settings?.names],
  );
  const codex = useMemo(() => (settings?.codex ?? []).filter((e) => inPhase(e, phase.id)), [settings?.codex, phase.id]);
  const locations = useMemo(() => phaseLocations(settings?.codex ?? [], phase.id), [settings?.codex, phase.id]);

  const order = submissions.map((s) => s.characterId);
  const wanted = Number(params.get('who'));
  const ownerId = order.includes(wanted) ? wanted : (order[0] ?? null);
  const submission = submissions.find((s) => s.characterId === ownerId);
  const links = useMemo(
    () => (ownerId === null ? null : submissionLinks(submissions, ownerId, characters, codex)),
    [submissions, ownerId, characters, codex],
  );
  const openCard = board.cards.find((c) => c.id === openCardId && c.characterId === ownerId) ?? null;

  if (actions.isLoading || !settings) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }
  if (actions.error) {
    return <Alert variant="danger" title="The submissions didn’t load">Try reloading the page.</Alert>;
  }
  if (!submissions.length || ownerId === null || !submission || !links) {
    return (
      <Card variant="bordered" padding="md" data-testid="gm-board-step-read">
        <CardBody>
          <p className="text-content-primary">No submissions in this phase yet.</p>
          {noCharacter > 0 && <NoCharacterNotice count={noCharacter} />}
        </CardBody>
      </Card>
    );
  }

  const pick = (id: number) => {
    const next = new URLSearchParams(params);
    next.set('who', String(id));
    setParams(next);
    setOpenCardId(null);
    window.scrollTo?.(0, 0);
  };

  const ensureChunks = (): Chunk[] => {
    if (board.chunks.length) return board.chunks;
    for (const c of DEFAULT_CHUNKS) store.update('chunk', c.id, () => ({ name: c.name, position: c.position }));
    return DEFAULT_CHUNKS;
  };

  const addCard = ({ text, paragraphs, isIF }: NewCardRequest) => {
    const chunks = board.chunks.length ? board.chunks : DEFAULT_CHUNKS;
    const placement = placeNewCard({
      board,
      chunks,
      locations,
      characters,
      ownerId,
      quote: text,
      submission: submission.text,
      paragraph: paragraphs.length ? Math.min(...paragraphs) : null,
      isIF,
    });
    if (!placement) {
      showToast('Add a location to the codex first: every card needs a row on the map.', 'warning', {
        action: { label: 'Open the codex', onClick: () => onOpenCodex() },
      });
      return;
    }
    const placed = ensureChunks();
    const card = newCard({
      id: newItemKey('card'),
      characterId: ownerId,
      quote: text,
      src: paragraphs,
      isIF,
      cond: isIF ? guessCondition(text) : '',
      ...placement,
    });
    store.update('card', card.id, () => cardDoc(card));
    const where = locations.find((l) => l.id === placement.locationId)?.name;
    const when = placed.find((c) => c.id === placement.chunkId)?.name;
    showToast(isIF ? 'IF card added to Contingencies until it triggers.' : `Card added to ${where} · ${when}.`, 'success', {
      action: { label: 'Open card', onClick: () => setOpenCardId(card.id) },
    });
  };

  const changeCard = (card: BoardCard, fields: Partial<BoardCard>) =>
    store.update<Omit<BoardCard, 'id'>>('card', card.id, (current) => ({ ...(current ?? cardDoc(card)), ...fields }));

  const deleteCard = (card: BoardCard) => {
    store.remove('card', card.id);
    setOpenCardId(null);
    showToast('Card deleted.', 'info', { action: { label: 'Undo', onClick: () => store.update('card', card.id, () => cardDoc(card)) } });
  };

  const createLocation = (name: string) => {
    const entry = newCodexEntry({ id: newItemKey('cx'), type: 'Location', name });
    settingsStore.update('codex', entry.id, () => codexDoc(entry));
    return entry.id;
  };

  const setStance = (from: number, to: number, value: Stance['value']) =>
    store.update<Stance>('stance', stanceKey(from, to), (current) => ({ ...current, value }));

  const isDone = !!board.readDone[ownerId];
  const toggleDone = () => {
    store.update<CharacterProgress>('progress', String(ownerId), (p) => setReadDone(p, !isDone));
    if (isDone) return;
    const next = nextNotDone(order, { ...board.readDone, [ownerId]: true }, ownerId);
    if (next !== null) {
      pick(next);
      showToast(`Now reading ${names.get(next)}.`, 'info');
    } else {
      showToast('Every submission read.', 'success', { action: { label: 'Go to the Map', onClick: onGoToMap } });
    }
  };

  const ownerName = names.get(ownerId) ?? `Character ${ownerId}`;
  const cardsOf = (id: number) => board.cards.filter((c) => c.characterId === id && !c.gm).length;
  const words = submission.text.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="grid grid-cols-[11rem_minmax(0,1fr)_18rem] gap-4 xl:grid-cols-[14rem_minmax(0,1fr)_24rem] xl:gap-6" data-testid="gm-board-step-read">
      <div className="sticky top-4 self-start">
        <ReadPlayerList
          players={order.map((id) => ({ id, name: names.get(id) ?? `Character ${id}`, cards: cardsOf(id), readDone: !!board.readDone[id] }))}
          selectedId={ownerId}
          onSelect={pick}
        />
        {noCharacter > 0 && <NoCharacterNotice count={noCharacter} />}
      </div>

      <article className="min-w-0 space-y-4" aria-label={`${ownerName}’s submission`}>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold text-content-primary">{ownerName}</h2>
          <span className="text-sm text-content-tertiary">
            {words} words · {cardsOf(ownerId)} card{cardsOf(ownerId) === 1 ? '' : 's'}
          </span>
          <span className="flex-1" />
          <Button type="button" size="sm" variant={isDone ? 'secondary' : 'primary'} onClick={toggleDone} title={isDone ? 'Mark as not read yet' : undefined}>
            {isDone ? '✓ Read' : 'Done reading → next'}
          </Button>
        </div>
        <p className="text-sm text-content-secondary">
          Card only what matters. Select a sentence or two to card just that part; hover a paragraph to card all of it.
          Highlighted text is already on a card: click it to open the card.
        </p>
        <SubmissionReader
          ownerId={ownerId}
          text={submission.text}
          cards={board.cards}
          characters={characters}
          codex={codex}
          sheetItems={sheetItems.get(ownerId)}
          onAddCard={addCard}
          onAddCodex={(text) => onOpenCodex(text)}
          onOpenCard={setOpenCardId}
        />
      </article>

      <div className="sticky top-4 self-start max-h-[calc(100vh-2rem)] overflow-y-auto">
        {openCard ? (
          <ReadCardPanel
            key={openCard.id}
            card={openCard}
            ownerName={ownerName}
            locations={locations}
            chunks={board.chunks}
            onChange={(fields) => changeCard(openCard, fields)}
            onCreateLocation={createLocation}
            onDelete={() => deleteCard(openCard)}
            onClose={() => setOpenCardId(null)}
          />
        ) : (
          <ReadSidebar
            ownerId={ownerId}
            names={names}
            submitters={order}
            stances={board.stances}
            cards={board.cards}
            chunks={board.chunks}
            codex={settings.codex}
            links={links}
            onSetStance={setStance}
            onOpenCard={setOpenCardId}
            onPickSubmission={pick}
          />
        )}
      </div>
    </div>
  );
}

function NoCharacterNotice({ count }: { count: number }) {
  return (
    <p className="mt-3 text-sm text-content-tertiary">
      {count} submission{count === 1 ? ' has' : 's have'} no character, so {count === 1 ? 'it isn’t' : 'they aren’t'} shown here.
      You can read {count === 1 ? 'it' : 'them'} in the results area.
    </p>
  );
}
