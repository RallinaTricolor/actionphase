import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderWithProviders } from '../../test-utils/render';
import { HistoryView } from '../HistoryView';
import type { GamePhase } from '../../types/phases';

describe('HistoryView', () => {
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
      }),
      // Mock action results endpoints (returns empty array since we're testing history display, not results)
      http.get('/api/v1/games/:gameId/results/mine', () => {
        return HttpResponse.json([]);
      }),
      http.get('/api/v1/games/:gameId/results', () => {
        return HttpResponse.json([]);
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
        <HistoryView
          gameId={mockGameId}
          currentPhaseId={mockCurrentPhaseId}
          isGM={false}
        />
      );

      // Wait for phases to load
      const openingPhase = await screen.findAllByText('Opening Ceremony');
      expect(openingPhase[0]).toBeInTheDocument();

      // Common room phases should be in a button (clickable)
      const openingButton = openingPhase[0].closest('button');
      expect(openingButton).toBeInTheDocument();
      expect(openingButton).not.toBeDisabled();
    });

    it('should make action phases clickable to view results', async () => {
      renderWithProviders(
        <HistoryView
          gameId={mockGameId}
          currentPhaseId={mockCurrentPhaseId}
          isGM={false}
        />
      );

      // Wait for phases to load
      const actionPhaseTitle = await screen.findAllByRole('heading', { name: /action phase/i });
      expect(actionPhaseTitle[0]).toBeInTheDocument();

      // Action phases SHOULD now be clickable buttons (to view action results)
      const actionButton = actionPhaseTitle[0].closest('button');
      expect(actionButton).toBeInTheDocument();
      expect(actionButton).not.toBeDisabled();
    });
  });
});
