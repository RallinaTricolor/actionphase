import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test-utils/render';
import { CharacterActionsMenu } from './CharacterActionsMenu';

vi.mock('@/hooks/useCharacters', () => ({
  useSetCharacterHidden: vi.fn(),
}));

import { useSetCharacterHidden } from '@/hooks/useCharacters';

const CHARACTER_ID = 7;
const GAME_ID = 3;

/**
 * The component reads only `mutate` and `isPending` off the mutation result,
 * so a partial envelope covers it -- same sanctioned shortcut the participant
 * menu's test takes.
 */
function mockMutation({ isPending = false } = {}) {
  const mutate = vi.fn();
  vi.mocked(useSetCharacterHidden).mockReturnValue({
    mutate,
    isPending,
  } as unknown as ReturnType<typeof useSetCharacterHidden>);
  return mutate;
}

function renderMenu(props: Partial<React.ComponentProps<typeof CharacterActionsMenu>> = {}) {
  return renderWithProviders(
    <CharacterActionsMenu
      characterId={CHARACTER_ID}
      gameId={GAME_ID}
      isHidden={false}
      canToggleHidden
      {...props}
    />
  );
}

describe('CharacterActionsMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutation();
  });

  it('renders nothing when the caller has no available actions', () => {
    // An empty kebab is worse than no kebab: it advertises an action the
    // caller cannot take.
    renderMenu({ canToggleHidden: false });

    expect(screen.queryByTestId('character-actions-menu')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Character actions' })).not.toBeInTheDocument();
  });

  it('keeps the action behind the trigger until opened', async () => {
    const user = userEvent.setup();
    renderMenu();

    // The whole point of the menu: the action costs no space when closed.
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.queryByText('Hide from players')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Character actions' }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Hide from players')).toBeInTheDocument();
  });

  it('labels the action "Hide from players" for a visible character', async () => {
    const user = userEvent.setup();
    renderMenu({ isHidden: false });

    await user.click(screen.getByRole('button', { name: 'Character actions' }));

    expect(screen.getByTestId('character-hidden-menu-item')).toHaveTextContent('Hide from players');
    // The consequences are worth stating on the way in, not on the way out.
    expect(screen.getByText(/Anything it has already posted stays visible/)).toBeInTheDocument();
  });

  it('labels the action "Reveal to players" for a hidden character', async () => {
    const user = userEvent.setup();
    renderMenu({ isHidden: true });

    await user.click(screen.getByRole('button', { name: 'Character actions' }));

    expect(screen.getByTestId('character-hidden-menu-item')).toHaveTextContent('Reveal to players');
    // Revealing takes nothing away, so it carries no warning.
    expect(screen.queryByText(/Anything it has already posted stays visible/)).not.toBeInTheDocument();
  });

  it('hides a visible character without confirmation', async () => {
    const user = userEvent.setup();
    const mutate = mockMutation();
    renderMenu({ isHidden: false });

    await user.click(screen.getByRole('button', { name: 'Character actions' }));
    await user.click(screen.getByTestId('character-hidden-menu-item'));

    // Freely reversible, so it fires straight away -- no modal in between.
    expect(mutate).toHaveBeenCalledWith({
      characterId: CHARACTER_ID,
      isHidden: true,
      gameId: GAME_ID,
    });
  });

  it('reveals a hidden character', async () => {
    const user = userEvent.setup();
    const mutate = mockMutation();
    renderMenu({ isHidden: true });

    await user.click(screen.getByRole('button', { name: 'Character actions' }));
    await user.click(screen.getByTestId('character-hidden-menu-item'));

    expect(mutate).toHaveBeenCalledWith({
      characterId: CHARACTER_ID,
      isHidden: false,
      gameId: GAME_ID,
    });
  });

  it('closes the menu after picking the action', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: 'Character actions' }));
    await user.click(screen.getByTestId('character-hidden-menu-item'));

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('closes the menu when clicking outside it', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: 'Character actions' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(document.body);

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('disables the action while the change is in flight', async () => {
    const user = userEvent.setup();
    mockMutation({ isPending: true });
    renderMenu();

    await user.click(screen.getByRole('button', { name: 'Character actions' }));

    expect(screen.getByTestId('character-hidden-menu-item')).toBeDisabled();
  });
});
