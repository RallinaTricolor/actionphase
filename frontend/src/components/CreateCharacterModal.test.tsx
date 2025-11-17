import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test-utils/render';
import { CreateCharacterModal } from './CreateCharacterModal';
import { apiClient } from '../lib/api';
import type { GameParticipant } from '../types/games';

// Mock the API client
vi.mock('../lib/api', () => ({
  apiClient: {
    characters: {
      createCharacter: vi.fn(),
    },
    getAuthToken: vi.fn(() => 'mock-token'),
    setAuthToken: vi.fn(),
    clearAuth: vi.fn(),
  },
}));

const mockPlayers: GameParticipant[] = [
  {
    id: 1,
    game_id: 604,
    user_id: 2,
    username: 'TestPlayer1',
    email: 'test_player1@example.com',
    role: 'player',
    status: 'active',
    joined_at: '2025-10-27T00:00:00Z',
  },
  {
    id: 2,
    game_id: 604,
    user_id: 3,
    username: 'TestPlayer2',
    email: 'test_player2@example.com',
    role: 'player',
    status: 'active',
    joined_at: '2025-10-27T00:00:00Z',
  },
];

const mockAudience: GameParticipant = {
  id: 3,
  game_id: 604,
  user_id: 5,
  username: 'TestAudience',
  email: 'test_audience@example.com',
  role: 'audience',
  status: 'active',
  joined_at: '2025-10-27T00:00:00Z',
};

describe('CreateCharacterModal', () => {
  const mockOnClose = vi.fn();
  const gameId = 604;

  beforeEach(() => {
    mockOnClose.mockClear();
    vi.mocked(apiClient.characters.createCharacter).mockClear();
  });

  describe('Modal Visibility', () => {
    it('does not render when isOpen is false', () => {
      renderWithProviders(
        <CreateCharacterModal
          isOpen={false}
          onClose={mockOnClose}
          gameId={gameId}
        />
      );

      expect(screen.queryByText('Create Character')).not.toBeInTheDocument();
    });

    it('renders when isOpen is true', () => {
      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
        />
      );

      expect(screen.getByRole('heading', { name: 'Create Character' })).toBeInTheDocument();
    });
  });

  describe('Player Role - Basic Functionality', () => {
    it('renders character name input', () => {
      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="player"
        />
      );

      expect(screen.getByLabelText(/Character Name/i)).toBeInTheDocument();
    });

    it('renders character type selector with only player character option', () => {
      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="player"
        />
      );

      expect(screen.getByLabelText(/Character Type/i)).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Player Character/i })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: /NPC/i })).not.toBeInTheDocument();
    });

    it('does not show user selector for players', () => {
      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="player"
          participants={mockPlayers}
        />
      );

      expect(screen.queryByLabelText(/Assign to Player/i)).not.toBeInTheDocument();
    });

    it('allows entering character name', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="player"
        />
      );

      const nameInput = screen.getByLabelText(/Character Name/i);
      await user.type(nameInput, 'My Test Character');

      expect(nameInput).toHaveValue('My Test Character');
    });

    it('submit button is disabled when name is empty', () => {
      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="player"
        />
      );

      const submitButton = screen.getByTestId('character-submit-button');
      expect(submitButton).toBeDisabled();
    });

    it('submit button is enabled when name is provided', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="player"
        />
      );

      const nameInput = screen.getByLabelText(/Character Name/i);
      await user.type(nameInput, 'My Test Character');

      const submitButton = screen.getByTestId('character-submit-button');
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('GM Role - Character Type Selection', () => {
    it('renders both player character and NPC options for GM', () => {
      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="gm"
          participants={mockPlayers}
        />
      );

      expect(screen.getByRole('option', { name: /Player Character/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /NPC/i })).toBeInTheDocument();
    });

    it('defaults to player character type', () => {
      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="gm"
          participants={mockPlayers}
        />
      );

      const typeSelect = screen.getByLabelText(/Character Type/i) as HTMLSelectElement;
      expect(typeSelect.value).toBe('player_character');
    });

    it('allows selecting NPC type', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="gm"
          participants={mockPlayers}
        />
      );

      const typeSelect = screen.getByLabelText(/Character Type/i);
      await user.selectOptions(typeSelect, 'npc');

      expect(typeSelect).toHaveValue('npc');
    });

    it('shows helper text for player character', () => {
      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="gm"
          participants={mockPlayers}
        />
      );

      expect(screen.getByText(/A character you'll control during the game/i)).toBeInTheDocument();
    });

    it('shows helper text for NPC', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="gm"
          participants={mockPlayers}
        />
      );

      const typeSelect = screen.getByLabelText(/Character Type/i);
      await user.selectOptions(typeSelect, 'npc');

      expect(screen.getByText(/A non-player character \(can be assigned to audience members\)/i)).toBeInTheDocument();
    });
  });

  describe('GM Role - User Selector for Player Characters', () => {
    it('shows user selector when GM creates player character', () => {
      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="gm"
          participants={mockPlayers}
        />
      );

      expect(screen.getByLabelText(/Assign to Player/i)).toBeInTheDocument();
    });

    it('hides user selector when GM creates NPC', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="gm"
          participants={mockPlayers}
        />
      );

      // Initially shows user selector for player character
      expect(screen.getByLabelText(/Assign to Player/i)).toBeInTheDocument();

      // Switch to NPC
      const typeSelect = screen.getByLabelText(/Character Type/i);
      await user.selectOptions(typeSelect, 'npc');

      // User selector should be hidden
      expect(screen.queryByLabelText(/Assign to Player/i)).not.toBeInTheDocument();
    });

    it('shows user selector again when switching back to player character', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="gm"
          participants={mockPlayers}
        />
      );

      // Switch to NPC
      const typeSelect = screen.getByLabelText(/Character Type/i);
      await user.selectOptions(typeSelect, 'npc');
      expect(screen.queryByLabelText(/Assign to Player/i)).not.toBeInTheDocument();

      // Switch back to player character
      await user.selectOptions(typeSelect, 'player_character');
      expect(screen.getByLabelText(/Assign to Player/i)).toBeInTheDocument();
    });

    it('lists all player participants in user selector', () => {
      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="gm"
          participants={mockPlayers}
        />
      );

      expect(screen.getByRole('option', { name: 'TestPlayer1' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'TestPlayer2' })).toBeInTheDocument();
    });

    it('does not list audience members in user selector', () => {
      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="gm"
          participants={[...mockPlayers, mockAudience]}
        />
      );

      expect(screen.getByRole('option', { name: 'TestPlayer1' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'TestPlayer2' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'TestAudience' })).not.toBeInTheDocument();
    });

    it('has placeholder option in user selector', () => {
      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="gm"
          participants={mockPlayers}
        />
      );

      expect(screen.getByRole('option', { name: /Select a player/i })).toBeInTheDocument();
    });

    it('allows selecting a player from dropdown', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="gm"
          participants={mockPlayers}
        />
      );

      const userSelect = screen.getByLabelText(/Assign to Player/i);
      await user.selectOptions(userSelect, '2');

      expect(userSelect).toHaveValue('2');
    });

    it('submit button is disabled when player character has no assigned user', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="gm"
          participants={mockPlayers}
        />
      );

      const nameInput = screen.getByLabelText(/Character Name/i);
      await user.type(nameInput, 'Test Character');

      const submitButton = screen.getByTestId('character-submit-button');
      expect(submitButton).toBeDisabled();
    });

    it('submit button is enabled when player character has name and assigned user', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="gm"
          participants={mockPlayers}
        />
      );

      const nameInput = screen.getByLabelText(/Character Name/i);
      await user.type(nameInput, 'Test Character');

      const userSelect = screen.getByLabelText(/Assign to Player/i);
      await user.selectOptions(userSelect, '2');

      const submitButton = screen.getByTestId('character-submit-button');
      expect(submitButton).not.toBeDisabled();
    });

    it('clears user_id when switching from player character to NPC', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.characters.createCharacter).mockResolvedValue({
        id: 433,
        game_id: gameId,
        name: 'Test NPC',
        character_type: 'npc',
        status: 'pending',
        created_at: '2025-10-27T00:00:00Z',
        updated_at: '2025-10-27T00:00:00Z',
        is_active: true,
      });

      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="gm"
          participants={mockPlayers}
        />
      );

      const nameInput = screen.getByLabelText(/Character Name/i);
      await user.type(nameInput, 'Test NPC');

      // Select a player
      const userSelect = screen.getByLabelText(/Assign to Player/i);
      await user.selectOptions(userSelect, '2');

      // Switch to NPC
      const typeSelect = screen.getByLabelText(/Character Type/i);
      await user.selectOptions(typeSelect, 'npc');

      // Submit
      const submitButton = screen.getByTestId('character-submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(apiClient.characters.createCharacter).toHaveBeenCalledWith(gameId, {
          name: 'Test NPC',
          character_type: 'npc',
          // user_id should NOT be present
        });
      });
    });
  });

  describe('Form Submission', () => {
    it('calls API with correct data for player creating player character', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.characters.createCharacter).mockResolvedValue({
        id: 433,
        game_id: gameId,
        name: 'Player Character',
        character_type: 'player_character',
        status: 'pending',
        created_at: '2025-10-27T00:00:00Z',
        updated_at: '2025-10-27T00:00:00Z',
        is_active: true,
      });

      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="player"
        />
      );

      const nameInput = screen.getByLabelText(/Character Name/i);
      await user.type(nameInput, 'Player Character');

      const submitButton = screen.getByTestId('character-submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(apiClient.characters.createCharacter).toHaveBeenCalledWith(gameId, {
          name: 'Player Character',
          character_type: 'player_character',
        });
      });
    });

    it('calls API with user_id for GM creating player character', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.characters.createCharacter).mockResolvedValue({
        id: 433,
        game_id: gameId,
        user_id: 2,
        name: 'Test Character',
        character_type: 'player_character',
        status: 'pending',
        created_at: '2025-10-27T00:00:00Z',
        updated_at: '2025-10-27T00:00:00Z',
        is_active: true,
      });

      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="gm"
          participants={mockPlayers}
        />
      );

      const nameInput = screen.getByLabelText(/Character Name/i);
      await user.type(nameInput, 'Test Character');

      const userSelect = screen.getByLabelText(/Assign to Player/i);
      await user.selectOptions(userSelect, '2');

      const submitButton = screen.getByTestId('character-submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(apiClient.characters.createCharacter).toHaveBeenCalledWith(gameId, {
          name: 'Test Character',
          character_type: 'player_character',
          user_id: 2,
        });
      });
    });

    it('calls API without user_id for GM creating NPC', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.characters.createCharacter).mockResolvedValue({
        id: 433,
        game_id: gameId,
        name: 'Test NPC',
        character_type: 'npc',
        status: 'pending',
        created_at: '2025-10-27T00:00:00Z',
        updated_at: '2025-10-27T00:00:00Z',
        is_active: true,
      });

      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="gm"
          participants={mockPlayers}
        />
      );

      const nameInput = screen.getByLabelText(/Character Name/i);
      await user.type(nameInput, 'Test NPC');

      const typeSelect = screen.getByLabelText(/Character Type/i);
      await user.selectOptions(typeSelect, 'npc');

      const submitButton = screen.getByTestId('character-submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(apiClient.characters.createCharacter).toHaveBeenCalledWith(gameId, {
          name: 'Test NPC',
          character_type: 'npc',
        });
      });
    });

    it('closes modal on successful submission', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.characters.createCharacter).mockResolvedValue({
        id: 433,
        game_id: gameId,
        name: 'Test Character',
        character_type: 'player_character',
        status: 'pending',
        created_at: '2025-10-27T00:00:00Z',
        updated_at: '2025-10-27T00:00:00Z',
        is_active: true,
      });

      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="player"
        />
      );

      const nameInput = screen.getByLabelText(/Character Name/i);
      await user.type(nameInput, 'Test Character');

      const submitButton = screen.getByTestId('character-submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it('shows error message on submission failure', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.characters.createCharacter).mockRejectedValue(
        new Error('Failed to create character')
      );

      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="player"
        />
      );

      const nameInput = screen.getByLabelText(/Character Name/i);
      await user.type(nameInput, 'Test Character');

      const submitButton = screen.getByTestId('character-submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed to create character/i)).toBeInTheDocument();
      });
    });
  });

  describe('Modal Close/Cancel', () => {
    it('calls onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="player"
        />
      );

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('resets form when modal is closed', async () => {
      const user = userEvent.setup();
      const { rerender } = renderWithProviders(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="player"
        />
      );

      // Enter some data
      const nameInput = screen.getByLabelText(/Character Name/i);
      await user.type(nameInput, 'Test Character');

      // Close modal
      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      // Reopen modal
      rerender(
        <CreateCharacterModal
          isOpen={true}
          onClose={mockOnClose}
          gameId={gameId}
          userRole="player"
        />
      );

      // Form should be reset
      const reopenedNameInput = screen.getByLabelText(/Character Name/i);
      expect(reopenedNameInput).toHaveValue('');
    });
  });
});
