import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useGameTabs } from './useGameTabs';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter initialEntries={['/games/1']}>{children}</MemoryRouter>
);

describe('useGameTabs', () => {
  describe('Bug #11: Messages tab visibility', () => {
    it('should show Messages tab for regular participants', () => {
      // Arrange: User is a regular player participant
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'in_progress',
            isGM: false,
            participantCount: 3,
            currentPhaseType: 'action',
            isAudience: false,
            isParticipant: true,
            hasCharacters: true,
          }),
        { wrapper }
      );

      // Assert: Messages tab should be present
      const messagesTab = result.current.tabs.find(tab => tab.id === 'messages');
      expect(messagesTab).toBeDefined();
    });

    it('should show Messages tab for GM', () => {
      // Arrange: User is the GM
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'in_progress',
            isGM: true,
            participantCount: 3,
            currentPhaseType: 'action',
            isAudience: false,
            isParticipant: false,
            hasCharacters: false,
          }),
        { wrapper }
      );

      // Assert: Messages tab should be present
      const messagesTab = result.current.tabs.find(tab => tab.id === 'messages');
      expect(messagesTab).toBeDefined();
    });

    it('should show Messages tab for audience member WITH assigned NPC', () => {
      // Arrange: User is an audience member with a character
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'in_progress',
            isGM: false,
            participantCount: 3,
            currentPhaseType: 'action',
            isAudience: true,
            isParticipant: false,
            hasCharacters: true, // Has an NPC assigned
          }),
        { wrapper }
      );

      // Assert: Messages tab should be present
      const messagesTab = result.current.tabs.find(tab => tab.id === 'messages');
      expect(messagesTab).toBeDefined();
    });

    it('should NOT show Messages tab for audience member WITHOUT assigned NPC', () => {
      // Arrange: User is an audience member without any characters
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'in_progress',
            isGM: false,
            participantCount: 3,
            currentPhaseType: 'action',
            isAudience: true,
            isParticipant: false,
            hasCharacters: false, // No NPC assigned
          }),
        { wrapper }
      );

      // Assert: Messages tab should NOT be present
      const messagesTab = result.current.tabs.find(tab => tab.id === 'messages');
      expect(messagesTab).toBeUndefined();
    });

    it('should NOT show Messages tab for non-participants', () => {
      // Arrange: User has not joined the game
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'in_progress',
            isGM: false,
            participantCount: 3,
            currentPhaseType: 'action',
            isAudience: false,
            isParticipant: false,
            hasCharacters: false,
          }),
        { wrapper }
      );

      // Assert: Messages tab should NOT be present
      const messagesTab = result.current.tabs.find(tab => tab.id === 'messages');
      expect(messagesTab).toBeUndefined();
    });
  });

  describe('Bug #12: Submit Action button visibility', () => {
    it('should show Actions tab for GM during action phase', () => {
      // Arrange: GM during action phase
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'in_progress',
            isGM: true,
            participantCount: 3,
            currentPhaseType: 'action',
            isAudience: false,
            isParticipant: false,
            hasCharacters: false,
          }),
        { wrapper }
      );

      // Assert: Actions tab should be present
      const actionsTab = result.current.tabs.find(tab => tab.id === 'actions');
      expect(actionsTab).toBeDefined();
      expect(actionsTab?.label).toBe('Actions'); // GM sees "Actions"
    });

    it('should show Submit Action tab for regular participants during action phase', () => {
      // Arrange: Regular player participant during action phase
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'in_progress',
            isGM: false,
            participantCount: 3,
            currentPhaseType: 'action',
            isAudience: false,
            isParticipant: true,
            hasCharacters: true,
          }),
        { wrapper }
      );

      // Assert: Actions tab should be present
      const actionsTab = result.current.tabs.find(tab => tab.id === 'actions');
      expect(actionsTab).toBeDefined();
      expect(actionsTab?.label).toBe('Submit Action'); // Players see "Submit Action"
    });

    it('should NOT show Submit Action tab for audience members during action phase', () => {
      // Arrange: Audience member during action phase
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'in_progress',
            isGM: false,
            participantCount: 3,
            currentPhaseType: 'action',
            isAudience: true,
            isParticipant: false,
            hasCharacters: true, // Even with NPC
          }),
        { wrapper }
      );

      // Assert: Actions tab should NOT be present
      const actionsTab = result.current.tabs.find(tab => tab.id === 'actions');
      expect(actionsTab).toBeUndefined();
    });

    it('should NOT show Submit Action tab for non-participants during action phase', () => {
      // Arrange: Non-participant viewing game during action phase
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'in_progress',
            isGM: false,
            participantCount: 3,
            currentPhaseType: 'action',
            isAudience: false,
            isParticipant: false,
            hasCharacters: false,
          }),
        { wrapper }
      );

      // Assert: Actions tab should NOT be present
      const actionsTab = result.current.tabs.find(tab => tab.id === 'actions');
      expect(actionsTab).toBeUndefined();
    });

    it('should NOT show Actions tab during non-action phases', () => {
      // Arrange: Participant during common room phase
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'in_progress',
            isGM: false,
            participantCount: 3,
            currentPhaseType: 'common_room',
            isAudience: false,
            isParticipant: true,
            hasCharacters: true,
          }),
        { wrapper }
      );

      // Assert: Actions tab should NOT be present
      const actionsTab = result.current.tabs.find(tab => tab.id === 'actions');
      expect(actionsTab).toBeUndefined();
    });
  });

  describe('Default tab behavior', () => {
    it('should default to common-room tab for in_progress games with common_room phase', async () => {
      // Arrange: In-progress game with common room phase
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'in_progress',
            isGM: false,
            participantCount: 3,
            currentPhaseType: 'common_room',
            isAudience: false,
            isParticipant: true,
            hasCharacters: true,
          }),
        { wrapper }
      );

      // Wait for useEffect to complete and update activeTab
      await waitFor(() => {
        expect(result.current.activeTab).toBe('common-room');
      });
    });

    it('should default to actions tab for in_progress games with action phase', () => {
      // Arrange: In-progress game with action phase
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'in_progress',
            isGM: false,
            participantCount: 3,
            currentPhaseType: 'action',
            isAudience: false,
            isParticipant: true,
            hasCharacters: true,
          }),
        { wrapper }
      );

      // Assert: Active tab should be actions
      expect(result.current.activeTab).toBe('actions');
    });

    it('should default to phases tab for GM when no common room or action phase', async () => {
      // Arrange: In-progress game, GM, no common room or action phase
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'in_progress',
            isGM: true,
            participantCount: 3,
            currentPhaseType: undefined,
            isAudience: false,
            isParticipant: false,
            hasCharacters: false,
          }),
        { wrapper }
      );

      // Wait for useEffect to complete and update activeTab
      await waitFor(() => {
        expect(result.current.activeTab).toBe('phases');
      });
    });

    it('should default to applications tab for GM in recruitment state', async () => {
      // Arrange: Recruitment game, GM
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'recruitment',
            isGM: true,
            participantCount: 0,
            currentPhaseType: undefined,
            isAudience: false,
            isParticipant: false,
            hasCharacters: false,
          }),
        { wrapper }
      );

      // Wait for useEffect to complete and update activeTab
      await waitFor(() => {
        expect(result.current.activeTab).toBe('applications');
      });
    });

    it('should default to info tab for players in recruitment state', async () => {
      // Arrange: Recruitment game, regular user
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'recruitment',
            isGM: false,
            participantCount: 0,
            currentPhaseType: undefined,
            isAudience: false,
            isParticipant: false,
            hasCharacters: false,
          }),
        { wrapper }
      );

      // Wait for useEffect to complete and update activeTab
      await waitFor(() => {
        expect(result.current.activeTab).toBe('info');
      });
    });
  });

  describe('Issue 1.2: Handouts tab visibility across all game states', () => {
    it('should show Handouts tab in setup state', () => {
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'setup',
            isGM: true,
            participantCount: 0,
            currentPhaseType: undefined,
            isAudience: false,
            isParticipant: false,
            hasCharacters: false,
          }),
        { wrapper }
      );

      const handoutsTab = result.current.tabs.find(tab => tab.id === 'handouts');
      expect(handoutsTab).toBeDefined();
    });

    it('should show Handouts tab in recruitment state', () => {
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'recruitment',
            isGM: false,
            participantCount: 0,
            currentPhaseType: undefined,
            isAudience: false,
            isParticipant: false,
            hasCharacters: false,
          }),
        { wrapper }
      );

      const handoutsTab = result.current.tabs.find(tab => tab.id === 'handouts');
      expect(handoutsTab).toBeDefined();
    });

    it('should show Handouts tab in character_creation state', () => {
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'character_creation',
            isGM: false,
            participantCount: 3,
            currentPhaseType: undefined,
            isAudience: false,
            isParticipant: true,
            hasCharacters: false,
          }),
        { wrapper }
      );

      const handoutsTab = result.current.tabs.find(tab => tab.id === 'handouts');
      expect(handoutsTab).toBeDefined();
    });

    it('should show Handouts tab in in_progress state', () => {
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'in_progress',
            isGM: false,
            participantCount: 3,
            currentPhaseType: 'action',
            isAudience: false,
            isParticipant: true,
            hasCharacters: true,
          }),
        { wrapper }
      );

      const handoutsTab = result.current.tabs.find(tab => tab.id === 'handouts');
      expect(handoutsTab).toBeDefined();
    });

    it('should show Handouts tab in completed state', () => {
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'completed',
            isGM: false,
            participantCount: 3,
            currentPhaseType: undefined,
            isAudience: false,
            isParticipant: true,
            hasCharacters: true,
          }),
        { wrapper }
      );

      const handoutsTab = result.current.tabs.find(tab => tab.id === 'handouts');
      expect(handoutsTab).toBeDefined();
    });

    it('should show Handouts tab in cancelled state', () => {
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'cancelled',
            isGM: true,
            participantCount: 0,
            currentPhaseType: undefined,
            isAudience: false,
            isParticipant: false,
            hasCharacters: false,
          }),
        { wrapper }
      );

      const handoutsTab = result.current.tabs.find(tab => tab.id === 'handouts');
      expect(handoutsTab).toBeDefined();
    });
  });

  describe('Issue 1.3: Applications tab visibility by game state', () => {
    it('should show Applications tab for GM during recruitment state', () => {
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'recruitment',
            isGM: true,
            participantCount: 0,
            currentPhaseType: undefined,
            isAudience: false,
            isParticipant: false,
            hasCharacters: false,
          }),
        { wrapper }
      );

      const applicationsTab = result.current.tabs.find(tab => tab.id === 'applications');
      expect(applicationsTab).toBeDefined();
      expect(applicationsTab?.label).toBe('Applications');
    });

    it('should NOT show Applications tab for players during recruitment state', () => {
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'recruitment',
            isGM: false,
            participantCount: 0,
            currentPhaseType: undefined,
            isAudience: false,
            isParticipant: false,
            hasCharacters: false,
          }),
        { wrapper }
      );

      const applicationsTab = result.current.tabs.find(tab => tab.id === 'applications');
      expect(applicationsTab).toBeUndefined();
    });

    it('should NOT show Applications tab during character_creation state (even for GM)', () => {
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'character_creation',
            isGM: true,
            participantCount: 3,
            currentPhaseType: undefined,
            isAudience: false,
            isParticipant: true,
            hasCharacters: false,
          }),
        { wrapper }
      );

      const applicationsTab = result.current.tabs.find(tab => tab.id === 'applications');
      expect(applicationsTab).toBeUndefined();
    });

    it('should NOT show Applications tab during in_progress state', () => {
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'in_progress',
            isGM: true,
            participantCount: 3,
            currentPhaseType: 'action',
            isAudience: false,
            isParticipant: false,
            hasCharacters: false,
          }),
        { wrapper }
      );

      const applicationsTab = result.current.tabs.find(tab => tab.id === 'applications');
      expect(applicationsTab).toBeUndefined();
    });

    it('should NOT show Applications tab during completed state', () => {
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'completed',
            isGM: true,
            participantCount: 3,
            currentPhaseType: undefined,
            isAudience: false,
            isParticipant: true,
            hasCharacters: true,
          }),
        { wrapper }
      );

      const applicationsTab = result.current.tabs.find(tab => tab.id === 'applications');
      expect(applicationsTab).toBeUndefined();
    });

    it('should NOT show Applications tab during cancelled state', () => {
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'cancelled',
            isGM: true,
            participantCount: 0,
            currentPhaseType: undefined,
            isAudience: false,
            isParticipant: false,
            hasCharacters: false,
          }),
        { wrapper }
      );

      const applicationsTab = result.current.tabs.find(tab => tab.id === 'applications');
      expect(applicationsTab).toBeUndefined();
    });

    it('should NOT show Applications tab during setup state', () => {
      const { result } = renderHook(
        () =>
          useGameTabs({
            gameState: 'setup',
            isGM: true,
            participantCount: 0,
            currentPhaseType: undefined,
            isAudience: false,
            isParticipant: false,
            hasCharacters: false,
          }),
        { wrapper }
      );

      const applicationsTab = result.current.tabs.find(tab => tab.id === 'applications');
      expect(applicationsTab).toBeUndefined();
    });
  });

  describe('Bug: comment deep-link with invalid tab redirects to history preserving comment param', () => {
    it('should redirect to history tab (not default) when common-room is invalid and comment param is present', async () => {
      // Simulate arriving at ?tab=common-room&comment=42 during an action phase
      // (common-room tab doesn't exist in the action phase tab list)
      const wrapperWithUrl = ({ children }: { children: React.ReactNode }) => (
        <MemoryRouter initialEntries={['/games/1?tab=common-room&comment=42']}>
          {children}
        </MemoryRouter>
      );

      const { result } = renderHook(
        () => useGameTabs({
          gameState: 'in_progress',
          isGM: false,
          participantCount: 3,
          currentPhaseType: 'action',
          isAudience: false,
          isParticipant: true,
          hasCharacters: true,
        }),
        { wrapper: wrapperWithUrl }
      );

      // Wait for the effect to run and redirect
      await waitFor(() => {
        // Active tab should be 'history', not 'actions' (the default for action phase)
        expect(result.current.activeTab).toBe('history');
      });
    });
  });
});
