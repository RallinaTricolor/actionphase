import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor as _waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse as _HttpResponse } from 'msw';
import { CurrentPhaseDisplay } from '../CurrentPhaseDisplay';
import { renderWithProviders } from '../../test-utils/render';
import { server } from '../../mocks/server';
import type { GamePhase } from '../../types/phases';

// Mock the CountdownTimer component to avoid time-dependent test complexity
vi.mock('../CountdownTimer', () => ({
  CountdownTimer: ({ deadline, onExpired, className }: unknown) => (
    <div className={className} data-testid="countdown-timer">
      Timer: {deadline}
      {onExpired && <button onClick={onExpired}>Trigger Expired</button>}
    </div>
  ),
}));

describe('CurrentPhaseDisplay', () => {
  const mockCommonRoomPhase: GamePhase = {
    id: 1,
    game_id: 1,
    phase_type: 'common_room',
    phase_number: 1,
    title: 'Opening Discussion',
    description: 'Players introduce themselves',
    start_time: '2025-01-01T00:00:00Z',
    deadline: '2025-12-31T23:59:59Z',
    is_active: true,
    is_published: false,
    created_at: '2025-01-01T00:00:00Z',
  };

  const mockActionPhase: GamePhase = {
    id: 2,
    game_id: 1,
    phase_type: 'action',
    phase_number: 2,
    title: 'First Action',
    description: 'Submit your actions',
    start_time: '2025-01-02T00:00:00Z',
    deadline: '2025-01-10T23:59:59Z',
    is_active: true,
    is_published: false,
    created_at: '2025-01-02T00:00:00Z',
  };

  const mockPublishedActionPhase: GamePhase = {
    ...mockActionPhase,
    id: 3,
    phase_number: 3,
    is_published: true,
  };

  const setupDefaultHandlers = (currentPhase: GamePhase | null = mockCommonRoomPhase, allPhases: GamePhase[] = []) => {
    server.use(
      http.get('/api/v1/games/:gameId/current-phase', () => {
        if (currentPhase) {
          return HttpResponse.json({ phase: currentPhase });
        }
        return HttpResponse.json({ phase: null });
      }),
      http.get('/api/v1/games/:gameId/phases', () => {
        return HttpResponse.json(allPhases);
      })
    );
  };

  beforeEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading skeleton while fetching phase', () => {
      renderWithProviders(<CurrentPhaseDisplay gameId={1} />);

      // Loading state shows skeleton with animate-pulse
      const loadingElement = document.querySelector('.animate-pulse');
      expect(loadingElement).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when phase fetch fails', async () => {
      server.use(
        http.get('/api/v1/games/:gameId/current-phase', () => {
          return HttpResponse.error();
        })
      );

      renderWithProviders(<CurrentPhaseDisplay gameId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load current phase/i)).toBeInTheDocument();
      });
    });

    it('should show error icon in error state', async () => {
      server.use(
        http.get('/api/v1/games/:gameId/current-phase', () => {
          return HttpResponse.error();
        })
      );

      renderWithProviders(<CurrentPhaseDisplay gameId={1} />);

      await waitFor(() => {
        const errorContainer = document.querySelector('.bg-semantic-danger-subtle');
        expect(errorContainer).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no active phase exists', async () => {
      setupDefaultHandlers(null);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} />);

      await waitFor(() => {
        expect(screen.getByText('No Active Phase')).toBeInTheDocument();
      });
    });

    it('should show GM-specific message when no phase (GM view)', async () => {
      setupDefaultHandlers(null);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} isGM={true} />);

      await waitFor(() => {
        expect(screen.getByText(/create a new phase to begin/i)).toBeInTheDocument();
      });
    });

    it('should show player message when no phase (player view)', async () => {
      setupDefaultHandlers(null);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} isGM={false} />);

      await waitFor(() => {
        expect(screen.getByText(/waiting for the GM to start/i)).toBeInTheDocument();
      });
    });
  });

  describe('Current Phase Display - Common Room', () => {
    it('should display common room phase details', async () => {
      setupDefaultHandlers(mockCommonRoomPhase);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} />);

      await waitFor(() => {
        expect(screen.getByText('Common Room')).toBeInTheDocument();
        expect(screen.getByText(/Phase 1/)).toBeInTheDocument();
        expect(screen.getByText(/Open discussion and roleplay/i)).toBeInTheDocument();
      });
    });

    it('should display phase start time', async () => {
      setupDefaultHandlers(mockCommonRoomPhase);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} />);

      await waitFor(() => {
        expect(screen.getByText('Started:')).toBeInTheDocument();
        // Date formatting may vary by locale, just check it exists
        const dateElement = screen.getByText(/Started:/).nextElementSibling;
        expect(dateElement).toBeInTheDocument();
      });
    });

    it('should display countdown timer when deadline exists', async () => {
      setupDefaultHandlers(mockCommonRoomPhase);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} />);

      await waitFor(() => {
        expect(screen.getByTestId('countdown-timer')).toBeInTheDocument();
      });
    });

    it('should show GM message for common room phase', async () => {
      setupDefaultHandlers(mockCommonRoomPhase);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} isGM={true} />);

      await waitFor(() => {
        expect(screen.getByText(/players can discuss and roleplay freely/i)).toBeInTheDocument();
      });
    });

    it('should show player message for common room phase', async () => {
      setupDefaultHandlers(mockCommonRoomPhase);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} isGM={false} />);

      await waitFor(() => {
        expect(screen.getByText(/discuss and interact with other players/i)).toBeInTheDocument();
      });
    });

    it('should display green icon for common room phase', async () => {
      setupDefaultHandlers(mockCommonRoomPhase);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} />);

      await waitFor(() => {
        const greenIcon = document.querySelector('.bg-semantic-success-subtle');
        expect(greenIcon).toBeInTheDocument();
      });
    });
  });

  describe('Current Phase Display - Action Phase', () => {
    it('should display action phase details', async () => {
      setupDefaultHandlers(mockActionPhase);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} />);

      await waitFor(() => {
        expect(screen.getByText('Action Phase')).toBeInTheDocument();
        expect(screen.getByText(/Phase 2/)).toBeInTheDocument();
        expect(screen.getByText(/Submit private actions to the GM/i)).toBeInTheDocument();
      });
    });

    it('should show GM message for action phase', async () => {
      setupDefaultHandlers(mockActionPhase);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} isGM={true} />);

      await waitFor(() => {
        expect(screen.getByText(/players are submitting their actions privately/i)).toBeInTheDocument();
      });
    });

    it('should show player message with submit button for action phase', async () => {
      setupDefaultHandlers(mockActionPhase);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} isGM={false} />);

      await waitFor(() => {
        expect(screen.getByText(/submit your action before the deadline/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /submit action/i })).toBeInTheDocument();
      });
    });

    it('should not show submit button for GM in action phase', async () => {
      setupDefaultHandlers(mockActionPhase);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} isGM={true} />);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /submit action/i })).not.toBeInTheDocument();
      });
    });

    it('should display blue icon for action phase', async () => {
      setupDefaultHandlers(mockActionPhase);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} />);

      await waitFor(() => {
        const blueIcon = document.querySelector('.bg-interactive-primary-subtle');
        expect(blueIcon).toBeInTheDocument();
      });
    });
  });

  describe('Current Phase Display - Published Action Phase', () => {
    it('should display "Results Published" label', async () => {
      setupDefaultHandlers(mockPublishedActionPhase);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} />);

      await waitFor(() => {
        expect(screen.getByText('Results Published')).toBeInTheDocument();
      });
    });

    it('should show GM message for published results', async () => {
      setupDefaultHandlers(mockPublishedActionPhase);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} isGM={true} />);

      await waitFor(() => {
        expect(screen.getByText(/results have been published to all players/i)).toBeInTheDocument();
      });
    });

    it('should show player message for published results', async () => {
      setupDefaultHandlers(mockPublishedActionPhase);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} isGM={false} />);

      await waitFor(() => {
        expect(screen.getByText(/the GM has published the results/i)).toBeInTheDocument();
      });
    });

    it('should display purple icon for published action phase', async () => {
      setupDefaultHandlers(mockPublishedActionPhase);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} />);

      await waitFor(() => {
        const purpleIcon = document.querySelector('.bg-interactive-primary-subtle');
        expect(purpleIcon).toBeInTheDocument();
      });
    });
  });

  describe('Previous Phases Section', () => {
    const previousPhase1: GamePhase = {
      id: 10,
      game_id: 1,
      phase_type: 'common_room',
      phase_number: 1,
      start_time: '2025-01-01T00:00:00Z',
      end_time: '2025-01-02T00:00:00Z',
      is_active: false,
      is_published: false,
      created_at: '2025-01-01T00:00:00Z',
    };

    const previousPhase2: GamePhase = {
      id: 11,
      game_id: 1,
      phase_type: 'action',
      phase_number: 2,
      start_time: '2025-01-02T00:00:00Z',
      end_time: '2025-01-03T00:00:00Z',
      is_active: false,
      is_published: true,
      created_at: '2025-01-02T00:00:00Z',
    };

    it('should not show previous phases section for GM', async () => {
      setupDefaultHandlers(mockCommonRoomPhase, [previousPhase1, previousPhase2]);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} isGM={true} />);

      await waitFor(() => {
        expect(screen.queryByText(/previous phases/i)).not.toBeInTheDocument();
      });
    });

    it('should show previous phases section for non-GM with phases', async () => {
      setupDefaultHandlers(mockCommonRoomPhase, [previousPhase1, previousPhase2]);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} isGM={false} />);

      await waitFor(() => {
        expect(screen.getByText(/Previous Phases \(2\)/i)).toBeInTheDocument();
      });
    });

    it('should expand previous phases when clicked', async () => {
      const _user = userEvent.setup();
      setupDefaultHandlers(mockCommonRoomPhase, [previousPhase1, previousPhase2]);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} isGM={false} />);

      await waitFor(() => {
        expect(screen.getByText(/Previous Phases \(2\)/i)).toBeInTheDocument();
      });

      // Initially should not show phase details
      expect(screen.queryByText('Completed')).not.toBeInTheDocument();

      // Click to expand
      const expandButton = screen.getByText(/Previous Phases \(2\)/i);
      await user.click(expandButton);

      // Should now show phase details
      await waitFor(() => {
        const completedBadges = screen.getAllByText('Completed');
        expect(completedBadges.length).toBeGreaterThan(0);
      });
    });

    it('should collapse previous phases when clicked again', async () => {
      const _user = userEvent.setup();
      setupDefaultHandlers(mockCommonRoomPhase, [previousPhase1]);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} isGM={false} />);

      const expandButton = await screen.findByText(/Previous Phases \(1\)/i);

      // Expand
      await user.click(expandButton);
      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument();
      });

      // Collapse
      await user.click(expandButton);
      await waitFor(() => {
        expect(screen.queryByText('Completed')).not.toBeInTheDocument();
      });
    });

    it('should display phase numbers in previous phases', async () => {
      const _user = userEvent.setup();
      setupDefaultHandlers(mockCommonRoomPhase, [previousPhase1, previousPhase2]);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} isGM={false} />);

      const expandButton = await screen.findByText(/Previous Phases \(2\)/i);
      await user.click(expandButton);

      await waitFor(() => {
        // Should show phase numbers - use getAllByText since Phase 1 appears in both current and previous
        const phase1Elements = screen.getAllByText(/Phase 1/);
        const phase2Elements = screen.getAllByText(/Phase 2/);
        expect(phase1Elements.length).toBeGreaterThan(0);
        expect(phase2Elements.length).toBeGreaterThan(0);
      });
    });

    it('should not show previous phases section when no phases exist', async () => {
      setupDefaultHandlers(mockCommonRoomPhase, []);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} isGM={false} />);

      await waitFor(() => {
        expect(screen.getByText('Common Room')).toBeInTheDocument();
      });

      expect(screen.queryByText(/Previous Phases/i)).not.toBeInTheDocument();
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', async () => {
      setupDefaultHandlers(mockCommonRoomPhase);

      const { container: _container } = renderWithProviders(
        <CurrentPhaseDisplay gameId={1} className="custom-test-class" />
      );

      await waitFor(() => {
        const elementWithClass = container.querySelector('.custom-test-class');
        expect(elementWithClass).toBeInTheDocument();
      });
    });
  });

  describe('Phase Expired Callback', () => {
    it('should call onPhaseExpired when countdown expires', async () => {
      const onPhaseExpired = vi.fn();
      setupDefaultHandlers(mockCommonRoomPhase);

      renderWithProviders(
        <CurrentPhaseDisplay gameId={1} onPhaseExpired={onPhaseExpired} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('countdown-timer')).toBeInTheDocument();
      });

      // Trigger the expired callback from mocked CountdownTimer
      const triggerButton = screen.getByRole('button', { name: /trigger expired/i });
      await userEvent.click(triggerButton);

      expect(onPhaseExpired).toHaveBeenCalledTimes(1);
    });
  });

  describe('Refetch Behavior', () => {
    it('should enable query when gameId is provided', async () => {
      setupDefaultHandlers(mockCommonRoomPhase);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} />);

      await waitFor(() => {
        expect(screen.getByText('Common Room')).toBeInTheDocument();
      });
    });

    it('should work with different gameId', async () => {
      server.use(
        http.get('/api/v1/games/:gameId/current-phase', ({ params }) => {
          expect(params.gameId).toBe('999');
          return HttpResponse.json({
            phase: {
              ...mockCommonRoomPhase,
              game_id: 999,
            },
          });
        })
      );

      renderWithProviders(<CurrentPhaseDisplay gameId={999} />);

      await waitFor(() => {
        expect(screen.getByText('Common Room')).toBeInTheDocument();
      });
    });
  });

  describe('Phase Display Variations', () => {
    it('should handle phase without deadline', async () => {
      const phaseWithoutDeadline = { ...mockCommonRoomPhase, deadline: undefined };
      setupDefaultHandlers(phaseWithoutDeadline);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} />);

      await waitFor(() => {
        expect(screen.getByText('Common Room')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('countdown-timer')).not.toBeInTheDocument();
    });

    it('should handle phase with custom title', async () => {
      const phaseWithTitle = { ...mockCommonRoomPhase, title: 'Custom Phase Title' };
      setupDefaultHandlers(phaseWithTitle);

      renderWithProviders(<CurrentPhaseDisplay gameId={1} />);

      await waitFor(() => {
        expect(screen.getByText('Common Room')).toBeInTheDocument();
      });
    });
  });
});
