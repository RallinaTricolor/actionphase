import { useEffect, useState } from 'react';
import { Link, useBlocker } from 'react-router-dom';
import { Alert, Button, Spinner } from '@/components/ui';
import { useGameContext } from '@/contexts/GameContext';
import { isGameWritable } from '@/lib/gamePermissions';
import { CharacterSheetEditor } from '@/components/characters/sheet-editor/CharacterSheetEditor';

/**
 * `/games/:gameId/character-sheet`: where a GM customises the game's
 * character sheet. A page rather than a modal, for the room to show the tab
 * list, a tab's fields and a preview together.
 */
export function CharacterSheetEditorPage() {
  const { gameId, game, isLoadingGame, isGM } = useGameContext();
  const [isDirty, setIsDirty] = useState(false);

  // An unsaved layout lives only in the editor's state, so leaving the page
  // loses it. Ask first, for in-app navigation and for closing the tab alike.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => isDirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  if (isLoadingGame) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Alert variant="danger" title="Game not found">
          This game doesn’t exist, or you can’t view it.
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Link to={`/games/${gameId}`} className="text-sm text-content-tertiary hover:underline">
          &larr; {game.title}
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-content-primary mt-1">Customize character sheet</h1>
        <p className="text-sm text-content-secondary mt-2">
          Choose the tabs every character sheet in this game has, and the fields on each tab’s entries.
          Players see the changes as soon as you save.
        </p>
      </div>

      {blocker.state === 'blocked' && (
        <Alert variant="warning" title="Unsaved changes">
          <div className="space-y-3">
            <p>Leave without saving your changes to the character sheet?</p>
            <div className="flex gap-2">
              <Button type="button" variant="danger" size="sm" onClick={() => blocker.proceed()}>
                Leave without saving
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => blocker.reset()}>
                Stay
              </Button>
            </div>
          </div>
        </Alert>
      )}

      {!isGM ? (
        <Alert variant="info">Only the game’s GMs can customise its character sheet.</Alert>
      ) : !isGameWritable(game.state) ? (
        <Alert variant="info">This game is archived, so its character sheet can no longer be changed.</Alert>
      ) : (
        <CharacterSheetEditor gameId={gameId} config={game.character_sheet} onDirtyChange={setIsDirty} />
      )}
    </div>
  );
}
