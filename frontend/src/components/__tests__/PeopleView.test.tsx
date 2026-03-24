import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { PeopleView } from '../PeopleView';
import type { GameParticipant } from '../../types/games';

const renderInRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

// Mock the child components that have complex dependencies
vi.mock('../CharactersList', () => ({
  CharactersList: () => <div data-testid="characters-list">Characters List</div>,
}));

vi.mock('../RemovePlayerButton', () => ({
  RemovePlayerButton: () => <div>Remove Player</div>,
}));

vi.mock('../AddPlayerModal', () => ({
  AddPlayerModal: () => <div>Add Player Modal</div>,
}));

vi.mock('../InactiveCharactersList', () => ({
  InactiveCharactersList: () => <div>Inactive Characters</div>,
}));

vi.mock('../AudienceMemberBadge', () => ({
  AudienceMemberBadge: () => <span>Audience</span>,
}));

describe('PeopleView - Leave Game Button', () => {
  const mockPlayerParticipant: GameParticipant = {
    id: 1,
    game_id: 1,
    user_id: 1,
    username: 'player1',
    email: 'player1@example.com',
    role: 'player',
    status: 'active',
    joined_at: '2024-01-01',
  };

  const mockAudienceParticipant: GameParticipant = {
    id: 2,
    game_id: 1,
    user_id: 2,
    username: 'audience1',
    email: 'audience1@example.com',
    role: 'audience',
    status: 'active',
    joined_at: '2024-01-02',
  };

  const mockGMParticipant: GameParticipant = {
    id: 3,
    game_id: 1,
    user_id: 3,
    username: 'gm1',
    email: 'gm1@example.com',
    role: 'gm',
    status: 'active',
    joined_at: '2024-01-03',
  };

  describe('Bug #9: Audience members cannot leave games', () => {
    it('should show Leave Game button for audience members', async () => {
      // Arrange: User is an audience member
      const user = userEvent.setup();

      renderInRouter(
        <PeopleView
          gameId={1}
          participants={[mockAudienceParticipant]}
          isGM={false}
          currentUserId={2} // User is audience1
          gameState="in_progress"
          onLeaveGame={vi.fn()}
        />
      );

      // Switch to Participants tab
      const participantsTab = screen.getByRole('button', { name: /participants/i });
      await user.click(participantsTab);

      // Assert: Leave Game button should be visible
      const leaveButton = screen.queryByRole('button', { name: /leave game/i });
      expect(leaveButton).toBeInTheDocument();
    });

    it('should not show Leave Game button for non-participants', async () => {
      // Arrange: User has no role in the game
      const user = userEvent.setup();

      renderInRouter(
        <PeopleView
          gameId={1}
          participants={[mockPlayerParticipant]}
          isGM={false}
          currentUserId={999} // User is not in the participants list
          gameState="in_progress"
          onLeaveGame={vi.fn()}
        />
      );

      // Switch to Participants tab
      const participantsTab = screen.getByRole('button', { name: /participants/i });
      await user.click(participantsTab);

      // Assert: Leave Game button should NOT be visible
      const leaveButton = screen.queryByRole('button', { name: /leave game/i });
      expect(leaveButton).not.toBeInTheDocument();
    });

    it('should call onLeaveGame when audience member clicks Leave Game', async () => {
      // Arrange
      const user = userEvent.setup();
      const onLeaveGame = vi.fn();

      renderInRouter(
        <PeopleView
          gameId={1}
          participants={[mockAudienceParticipant]}
          isGM={false}
          currentUserId={2} // User is audience1
          gameState="in_progress"
          onLeaveGame={onLeaveGame}
        />
      );

      // Switch to Participants tab
      const participantsTab = screen.getByRole('button', { name: /participants/i });
      await user.click(participantsTab);

      // Act
      const leaveButton = screen.getByRole('button', { name: /leave game/i });
      await user.click(leaveButton);

      // Assert
      expect(onLeaveGame).toHaveBeenCalledTimes(1);
    });

    it('should show Leave Game button for regular participants', async () => {
      // Arrange: User is a regular player participant
      const user = userEvent.setup();

      renderInRouter(
        <PeopleView
          gameId={1}
          participants={[mockPlayerParticipant]}
          isGM={false}
          currentUserId={1} // User is player1
          gameState="in_progress"
          onLeaveGame={vi.fn()}
        />
      );

      // Switch to Participants tab
      const participantsTab = screen.getByRole('button', { name: /participants/i });
      await user.click(participantsTab);

      // Assert: Leave Game button should be visible
      const leaveButton = screen.queryByRole('button', { name: /leave game/i });
      expect(leaveButton).toBeInTheDocument();
    });

    it('should not show Leave Game button in completed games', async () => {
      // Arrange
      const user = userEvent.setup();

      renderInRouter(
        <PeopleView
          gameId={1}
          participants={[mockAudienceParticipant]}
          isGM={false}
          currentUserId={2} // User is audience1
          gameState="completed"
          onLeaveGame={vi.fn()}
        />
      );

      // Switch to Participants tab
      const participantsTab = screen.getByRole('button', { name: /participants/i });
      await user.click(participantsTab);

      // Assert
      const leaveButton = screen.queryByRole('button', { name: /leave game/i });
      expect(leaveButton).not.toBeInTheDocument();
    });

    it('should not show Leave Game button in cancelled games', async () => {
      // Arrange
      const user = userEvent.setup();

      renderInRouter(
        <PeopleView
          gameId={1}
          participants={[mockAudienceParticipant]}
          isGM={false}
          currentUserId={2} // User is audience1
          gameState="cancelled"
          onLeaveGame={vi.fn()}
        />
      );

      // Switch to Participants tab
      const participantsTab = screen.getByRole('button', { name: /participants/i });
      await user.click(participantsTab);

      // Assert
      const leaveButton = screen.queryByRole('button', { name: /leave game/i });
      expect(leaveButton).not.toBeInTheDocument();
    });

    it('should not show Leave Game button when onLeaveGame is not provided', async () => {
      // Arrange: onLeaveGame callback is undefined
      const user = userEvent.setup();

      renderInRouter(
        <PeopleView
          gameId={1}
          participants={[mockPlayerParticipant]}
          isGM={false}
          currentUserId={1} // User is player1
          gameState="in_progress"
          // onLeaveGame is undefined
        />
      );

      // Switch to Participants tab
      const participantsTab = screen.getByRole('button', { name: /participants/i });
      await user.click(participantsTab);

      // Assert
      const leaveButton = screen.queryByRole('button', { name: /leave game/i });
      expect(leaveButton).not.toBeInTheDocument();
    });

    it('should not show Leave Game button for GM', async () => {
      // Arrange: Current user is the GM
      const user = userEvent.setup();

      renderInRouter(
        <PeopleView
          gameId={1}
          participants={[mockGMParticipant]}
          isGM={true}
          currentUserId={3} // User is gm1
          gameState="in_progress"
          onLeaveGame={vi.fn()}
        />
      );

      // Switch to Participants tab
      const participantsTab = screen.getByRole('button', { name: /participants/i });
      await user.click(participantsTab);

      // Assert: GM should not see Leave Game button
      const leaveButton = screen.queryByRole('button', { name: /leave game/i });
      expect(leaveButton).not.toBeInTheDocument();
    });

    it('should disable Leave Game button when actionLoading is true', async () => {
      // Arrange
      const user = userEvent.setup();

      renderInRouter(
        <PeopleView
          gameId={1}
          participants={[mockPlayerParticipant]}
          isGM={false}
          currentUserId={1} // User is player1
          gameState="in_progress"
          onLeaveGame={vi.fn()}
          actionLoading={true}
        />
      );

      // Switch to Participants tab
      const participantsTab = screen.getByRole('button', { name: /participants/i });
      await user.click(participantsTab);

      // Assert: Button should be disabled
      const leaveButton = screen.getByRole('button', { name: /leave game/i });
      expect(leaveButton).toBeDisabled();
    });
  });
});
