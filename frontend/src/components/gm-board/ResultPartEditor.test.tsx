import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import { BoardUnsavedTextContext } from '@/hooks/useBoardReadOnly';
import { ResultPartEditor } from './ResultPartEditor';

const GAME_ID = 7;

const editor = (keep: (label: string, text: string) => void) => (
  <BoardUnsavedTextContext.Provider value={keep}>
    <ResultPartEditor
      gameId={GAME_ID}
      target={{ kind: 'new-result', phaseId: 70, userId: 11, characterId: 1 }}
      onCreated={vi.fn()}
      onText={vi.fn()}
      insertTextRef={createRef() as never}
      transformTextRef={createRef() as never}
      flushRef={createRef() as never}
      placeholder="Write the result"
      label="Result 1"
    />
  </BoardUnsavedTextContext.Provider>
);

describe('ResultPartEditor', () => {
  it('reports the text once, however often the parent re-renders with a new callback', () => {
    server.use(http.post(`/api/v1/games/${GAME_ID}/results`, () => HttpResponse.json({}, { status: 500 })));
    const onText = vi.fn();
    const props = {
      gameId: GAME_ID,
      target: { kind: 'new-result', phaseId: 70, userId: 11, characterId: 1 } as const,
      onCreated: vi.fn(),
      insertTextRef: { current: null },
      transformTextRef: { current: null },
      flushRef: { current: null },
      placeholder: 'Write the result',
      label: 'Result 1',
    };
    const { rerender } = renderWithProviders(<ResultPartEditor {...props} onText={(t) => onText(t)} />, { gameId: GAME_ID });
    rerender(<ResultPartEditor {...props} onText={(t) => onText(t)} />);
    rerender(<ResultPartEditor {...props} onText={(t) => onText(t)} />);
    expect(onText).toHaveBeenCalledTimes(1);
  });

  it('keeps the text when the phase has ended, and hands it to the board when it closes', async () => {
    server.use(
      http.post(`/api/v1/games/${GAME_ID}/results`, () =>
        HttpResponse.json({ status: 423, title: 'Locked', detail: 'This phase isn’t active.' }, { status: 423 }),
      ),
    );
    const keep = vi.fn();
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(editor(keep), { gameId: GAME_ID });

    await user.type(screen.getByTestId('result-draft'), 'Too late');
    expect(await screen.findByText(/isn’t active any more, so this can’t be saved/, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByTestId('result-draft')).toHaveValue('Too late');
    expect(keep).not.toHaveBeenCalled();

    unmount();
    await waitFor(() => expect(keep).toHaveBeenCalledWith('Result 1', 'Too late'));
  });
});
