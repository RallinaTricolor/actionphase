import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Badge, Button, Card, CardBody, HelpTooltip, Spinner } from '@/components/ui';
import { useGameContext } from '@/contexts/GameContext';
import { useToast } from '@/contexts/ToastContext';
import { useBoardCardActions } from '@/hooks/useBoardCardActions';
import { useBoardReadOnly } from '@/hooks/useBoardReadOnly';
import { useBoardSubmissions } from '@/hooks/useBoardSubmissions';
import { useGameCharacterSheetItems } from '@/hooks/useCharacterSheetItems';
import { useGmBoardStore, useGmSettings, useGmSettingsStore } from '@/hooks/useGmBoard';
import { cardDoc, newCard } from '@/lib/gmBoard/cards';
import { boardCast } from '@/lib/gmBoard/cast';
import { codexDoc, inPhase, newCodexEntry, phaseLocations } from '@/lib/gmBoard/codex';
import { nextNotDone, setReadDone } from '@/lib/gmBoard/progress';
import { boardRows } from '@/lib/gmBoard/map';
import { DEFAULT_CHUNKS, guessCondition, placeNewCard, submissionLinks, type NamedCharacter } from '@/lib/gmBoard/read';
import { stanceKey } from '@/lib/gmBoard/stances';
import { newItemKey } from '@/lib/gmBoard/store';
import { characterNames } from '@/lib/gmBoard/text';
import type { BoardDoc, CharacterProgress, Chunk, Stance } from '@/lib/gmBoard/types';
import type { GamePhase } from '@/types/phases';
import { AwardDialog } from './AwardDialog';
import { BoardPane } from './BoardPane';
import { BoardToolbar } from './BoardToolbar';
import { useOptionalBoardRewards } from './boardRewards';
import { CardPanel } from './CardPanel';
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
  const readOnly = useBoardReadOnly();

  const actions = useBoardSubmissions(gameId, phase.id);

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
  const pickable = useMemo(
    () => boardRows(settings?.codex ?? [], phase.id, board.cards).filter((r) => r.kind !== 'missing'),
    [settings?.codex, phase.id, board.cards],
  );
  const cardActions = useBoardCardActions(gameId, phase.id, board, names);

  const order = submissions.map((s) => s.characterId);
  const wanted = Number(params.get('who'));
  const ownerId = order.includes(wanted) ? wanted : (order[0] ?? null);
  const submission = submissions.find((s) => s.characterId === ownerId);
  const links = useMemo(
    () => (ownerId === null ? null : submissionLinks(submissions, ownerId, characters, codex)),
    [submissions, ownerId, characters, codex],
  );
  const openCard = board.cards.find((c) => c.id === openCardId && c.characterId === ownerId) ?? null;
  const rewards = useOptionalBoardRewards();
  const [awarding, setAwarding] = useState<string | null>(null);

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
        <CardBody className="space-y-3">
          <p className="text-content-primary">No submissions in this phase yet.</p>
          {!readOnly && (
            <>
              <p className="text-sm text-content-secondary">
                They show here as players send them. In the meantime you can write the codex, or plan events on the Map with GM cards.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => onOpenCodex()}>
                  Open the codex
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={onGoToMap}>
                  Go to the Map
                </Button>
              </div>
            </>
          )}
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
    <div className="space-y-4" data-testid="gm-board-step-read">
      <BoardToolbar aria-label="Submissions">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ReadPlayerList
            players={order.map((id) => ({ id, name: names.get(id) ?? `Character ${id}`, cards: cardsOf(id), readDone: !!board.readDone[id] }))}
            selectedId={ownerId}
            onSelect={pick}
          />
          {noCharacter > 0 && <NoCharacterNotice count={noCharacter} />}
        </div>
      </BoardToolbar>

      <div className="grid grid-cols-[minmax(0,1fr)_20rem] items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <BoardPane
          aria-label={`${ownerName}’s submission`}
          title={
            <div className="flex min-w-0 items-baseline gap-3">
              <h2 className="truncate text-base font-semibold text-content-primary">{ownerName}</h2>
              <span className="text-sm text-content-tertiary">
                {words} words · {cardsOf(ownerId)} card{cardsOf(ownerId) === 1 ? '' : 's'}
              </span>
              <HelpTooltip
                text={
                  readOnly
                    ? 'Highlighted text is on a card: click it to open the card.'
                    : 'Card only what matters. Select a sentence or two to card just that part; hover a paragraph to card all of it. Highlighted text is already on a card: click it to open the card.'
                }
              />
            </div>
          }
          actions={
            readOnly ? (
              isDone && <Badge variant="success">✓ Read</Badge>
            ) : (
              <Button type="button" size="sm" variant={isDone ? 'secondary' : 'primary'} onClick={toggleDone} title={isDone ? 'Mark as not read yet' : undefined}>
                {isDone ? '✓ Read' : 'Done reading → next'}
              </Button>
            )
          }
          bodyClassName="px-5 py-4"
        >
          <SubmissionReader
            ownerId={ownerId}
            text={submission.text}
            cards={board.cards}
            characters={characters}
            codex={codex}
            sheetItems={sheetItems.get(ownerId)}
            readOnly={readOnly}
            onAddCard={readOnly ? undefined : addCard}
            onAddCodex={readOnly ? undefined : (text) => onOpenCodex(text)}
            onAddAward={rewards && !readOnly ? setAwarding : undefined}
            onOpenCard={setOpenCardId}
          />
          {rewards && !readOnly && <AwardDialog key={ownerId} quote={awarding} characterId={ownerId} name={ownerName} onClose={() => setAwarding(null)} />}
        </BoardPane>

        <BoardPane sticky title={openCard ? undefined : 'Around this submission'}>
          {openCard ? (
            <CardPanel
              key={openCard.id}
              card={openCard}
              board={board}
              names={names}
              locations={pickable}
              onChange={(fields) => cardActions.change(openCard, fields)}
              onCreateLocation={createLocation}
              onSplit={(at) => cardActions.split(openCard, at)}
              onPushLater={() => cardActions.pushLater(openCard)}
              onDelete={() => {
                cardActions.remove(openCard);
                setOpenCardId(null);
              }}
              onClose={() => setOpenCardId(null)}
              readOnly={readOnly}
            />
          ) : (
            <ReadSidebar
              readOnly={readOnly}
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
        </BoardPane>
      </div>
    </div>
  );
}

function NoCharacterNotice({ count }: { count: number }) {
  return (
    <p className="text-xs text-content-tertiary">
      {count} submission{count === 1 ? ' has' : 's have'} no character, so {count === 1 ? 'it isn’t' : 'they aren’t'} shown here.
      You can read {count === 1 ? 'it' : 'them'} in the results area.
    </p>
  );
}
