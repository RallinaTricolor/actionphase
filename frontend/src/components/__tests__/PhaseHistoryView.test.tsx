import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderWithProviders } from '../../test-utils/render';
import { PhaseHistoryView } from '../PhaseHistoryView';
import type { GamePhase } from '../../types/phases';

describe('PhaseHistoryView', () => {
  const mockGameId = 1;
  const mockCurrentPhaseId = 3;

  const mockPhases: GamePhase[] = [
    {
      id: 1,
      game_id: mockGameId,
      phase_number: 1,
      phase_type: 'common_room',
      title: 'Opening Ceremony',
      description: 'Welcome to the game!',
      status: 'completed',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-02T00:00:00Z',
    },
    {
      id: 2,
      game_id: mockGameId,
      phase_number: 2,
      phase_type: 'action',
      title: null,
      description: 'Submit your actions',
      status: 'completed',
      created_at: '2025-01-03T00:00:00Z',
      updated_at: '2025-01-04T00:00:00Z',
    },
    {
      id: 3,
      game_id: mockGameId,
      phase_number: 3,
      phase_type: 'common_room',
      title: 'Midgame Discussion',
      description: 'React to the results',
      status: 'active',
      created_at: '2025-01-05T00:00:00Z',
      updated_at: '2025-01-05T00:00:00Z',
    },
  ];

  const setupHandlers = (phases: GamePhase[] = mockPhases) => {
    server.use(
      http.get('/api/v1/games/:gameId/phases', () => {
        return HttpResponse.json(phases);
      })
    );
  };

  beforeEach(() => {
    server.resetHandlers();
    setupHandlers();
  });

  describe('Bug #4: Action Phases clickable but have no content', () => {
    it('should make common_room phases clickable', async () => {
      renderWithProviders(
        <PhaseHistoryView
          gameId={mockGameId}
          currentPhaseId={mockCurrentPhaseId}
          isGM={false}
        />
      );

      // Wait for phases to load
      const openingPhase = await screen.findByText('Opening Ceremony');
      expect(openingPhase).toBeInTheDocument();

      // Common room phases should be in a button (clickable)
      const openingButton = openingPhase.closest('button');
      expect(openingButton).toBeInTheDocument();
      expect(openingButton).not.toBeDisabled();
    });

    it('should make action phases non-clickable since they have no content', async () => {
      renderWithProviders(
        <PhaseHistoryView
          gameId={mockGameId}
          currentPhaseId={mockCurrentPhaseId}
          isGM={false}
        />
      );

      // Wait for phases to load
      const actionPhaseTitle = await screen.findByRole('heading', { name: /action phase/i });
      expect(actionPhaseTitle).toBeInTheDocument();

      // Action phases should NOT be in a clickable button
      // They should be in a div or have a visual indicator they're not interactive
      const actionContainer = actionPhaseTitle.closest('button');

      // Action phases should NOT be buttons at all
      expect(actionContainer).toBeNull();

      // Should be in a div instead
      const divContainer = actionPhaseTitle.closest('div[class*="cursor-not-allowed"]');
      expect(divContainer).toBeInTheDocument();
    });

    it('should visually distinguish non-clickable action phases', async () => {
      renderWithProviders(
        <PhaseHistoryView
          gameId={mockGameId}
          currentPhaseId={mockCurrentPhaseId}
          isGM={false}
        />
      );

      // Wait for phases to load
      await screen.findByText('Opening Ceremony');

      // Find action phase element by heading role
      const actionPhaseHeading = screen.getByRole('heading', { name: /action phase/i });
      const actionPhaseContainer = actionPhaseHeading.closest('[class*="border"]');

      // Should have visual indication it's not interactive
      // e.g., opacity-60, cursor-not-allowed, border-theme-subtle
      expect(actionPhaseContainer?.className).toMatch(/opacity-60|cursor-not-allowed|border-theme-subtle/);
    });
  });
});
