import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { useGameTabs } from './useGameTabs';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
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
});
