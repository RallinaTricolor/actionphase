import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { GameActions } from './GameActions';
import type { Game } from '../types/games';

describe('GameActions', () => {
  const mockGame: Game = {
    id: 1,
    title: 'Test Game',
    description: 'Test Description',
    state: 'in_progress',
    gm_user_id: 999,
    gm_username: 'TestGM',
    current_players: 5,
    max_players: 10,
    genre: 'Fantasy',
    is_public: true,
    is_anonymous: false,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  };

  const defaultProps = {
    game: mockGame,
    isGM: false,
    isCheckingAuth: false,
    isParticipant: false,
    userRole: 'none' as const,
    userApplication: null,
    actionLoading: false,
    stateActions: [],
    onEditGame: vi.fn(),
    onStateChange: vi.fn(),
    onApplyToGame: vi.fn(),
    onWithdrawApplication: vi.fn(),
    onLeaveGame: vi.fn(),
    onJoinAsAudience: vi.fn(),
  };

  describe('Bug #9: Audience members cannot leave games', () => {
    it('should show Leave Game button for audience members', () => {
      // Arrange: User is an audience member
      render(
        <GameActions
          {...defaultProps}
          userRole="audience"
          isParticipant={false}
        />
      );

      // Assert: Leave Game button should be visible
      const leaveButton = screen.queryByRole('button', { name: /leave game/i });
      expect(leaveButton).toBeInTheDocument();
    });

    it('should not show Leave Game button for non-participants', () => {
      // Arrange: User has no role in the game
      render(
        <GameActions
          {...defaultProps}
          userRole="none"
          isParticipant={false}
        />
      );

      // Assert: Leave Game button should NOT be visible
      const leaveButton = screen.queryByRole('button', { name: /leave game/i });
      expect(leaveButton).not.toBeInTheDocument();
    });

    it('should call onLeaveGame when audience member clicks Leave Game', async () => {
      // Arrange
      const user = userEvent.setup();
      const onLeaveGame = vi.fn();

      render(
        <GameActions
          {...defaultProps}
          userRole="audience"
          isParticipant={false}
          onLeaveGame={onLeaveGame}
        />
      );

      // Act
      const leaveButton = screen.getByRole('button', { name: /leave game/i });
      await user.click(leaveButton);

      // Assert
      expect(onLeaveGame).toHaveBeenCalledTimes(1);
    });

    it('should show Leave Game button for regular participants', () => {
      // Arrange: User is a regular player participant
      render(
        <GameActions
          {...defaultProps}
          userRole="player"
          isParticipant={true}
        />
      );

      // Assert: Leave Game button should be visible
      const leaveButton = screen.queryByRole('button', { name: /leave game/i });
      expect(leaveButton).toBeInTheDocument();
    });

    it('should not show Leave Game button in completed games', () => {
      // Arrange
      render(
        <GameActions
          {...defaultProps}
          game={{ ...mockGame, state: 'completed' }}
          userRole="audience"
          isParticipant={false}
        />
      );

      // Assert
      const leaveButton = screen.queryByRole('button', { name: /leave game/i });
      expect(leaveButton).not.toBeInTheDocument();
    });

    it('should not show Leave Game button in cancelled games', () => {
      // Arrange
      render(
        <GameActions
          {...defaultProps}
          game={{ ...mockGame, state: 'cancelled' }}
          userRole="audience"
          isParticipant={false}
        />
      );

      // Assert
      const leaveButton = screen.queryByRole('button', { name: /leave game/i });
      expect(leaveButton).not.toBeInTheDocument();
    });
  });
});
