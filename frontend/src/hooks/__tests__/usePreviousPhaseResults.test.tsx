import React from 'react';
import { renderHook, waitFor as _waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePreviousPhaseResults } from '../usePreviousPhaseResults';
import { apiClient } from '../../lib/api';
import type { GamePhase, ActionResult } from '../../types/phases';

// Mock the API client
vi.mock('../../lib/api', () => ({
  apiClient: {
    phases: {
      getGamePhases: vi.fn(),
      getUserResults: vi.fn(),
      getGameResults: vi.fn(),
    },
  },
}));

describe('usePreviousPhaseResults', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const mockPhases: GamePhase[] = [
    {
      id: 1,
      game_id: 100,
      phase_number: 1,
      phase_type: 'action',
      title: 'Investigation Phase',
      description: 'Investigate the mansion',
      deadline: '2025-10-30T00:00:00Z',
      is_current: false,
      created_at: '2025-10-20T00:00:00Z',
      updated_at: '2025-10-20T00:00:00Z',
    },
    {
      id: 2,
      game_id: 100,
      phase_number: 2,
      phase_type: 'common_room',
      title: 'Discussion Phase',
      description: 'Discuss your findings',
      deadline: '2025-11-05T00:00:00Z',
      is_current: true,
      created_at: '2025-10-28T00:00:00Z',
      updated_at: '2025-10-28T00:00:00Z',
    },
  ];

  const mockResults: ActionResult[] = [
    {
      id: 1,
      game_id: 100,
      user_id: 1,
      phase_id: 1,
      gm_user_id: 10,
      content: '# Investigation Results\n\nYou found a clue.',
      is_published: true,
      sent_at: '2025-10-28T00:00:00Z',
      username: 'Player1',
    },
  ];

  describe('Basic Functionality', () => {
    it('should return default state when no current phase', async () => {
      vi.mocked(apiClient.phases.getGamePhases).mockResolvedValue({ data: mockPhases });
      vi.mocked(apiClient.phases.getUserResults).mockResolvedValue({ data: mockResults });

      const { result } = renderHook(() => usePreviousPhaseResults(100, null, false), { wrapper });

      await waitFor(() => {
        expect(result.current.shouldShowResults).toBe(false);
        expect(result.current.results).toEqual([]);
        expect(result.current.previousPhaseId).toBeNull();
        expect(result.current.previousPhaseTitle).toBeNull();
      });
    });

    it('should return default state when current phase is not common_room', async () => {
      const actionPhase: GamePhase = {
        ...mockPhases[0],
        is_current: true,
      };

      vi.mocked(apiClient.phases.getGamePhases).mockResolvedValue({ data: mockPhases });
      vi.mocked(apiClient.phases.getUserResults).mockResolvedValue({ data: mockResults });

      const { result } = renderHook(() => usePreviousPhaseResults(100, actionPhase, false), { wrapper });

      await waitFor(() => {
        expect(result.current.shouldShowResults).toBe(false);
      });
    });

    it('should return default state when there is no previous phase', async () => {
      const firstPhase: GamePhase = {
        id: 1,
        game_id: 100,
        phase_number: 1,
        phase_type: 'common_room',
        title: 'First Discussion',
        description: 'Opening discussion',
        deadline: '2025-10-30T00:00:00Z',
        is_current: true,
        created_at: '2025-10-20T00:00:00Z',
        updated_at: '2025-10-20T00:00:00Z',
      };

      vi.mocked(apiClient.phases.getGamePhases).mockResolvedValue({ data: [firstPhase] });
      vi.mocked(apiClient.phases.getUserResults).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => usePreviousPhaseResults(100, firstPhase, false), { wrapper });

      await waitFor(() => {
        expect(result.current.shouldShowResults).toBe(false);
      });
    });
  });

  describe('Show Results Conditions', () => {
    it('should show results when current is common_room and previous is action with published results', async () => {
      vi.mocked(apiClient.phases.getGamePhases).mockResolvedValue({ data: mockPhases });
      vi.mocked(apiClient.phases.getUserResults).mockResolvedValue({ data: mockResults });

      const { result } = renderHook(() => usePreviousPhaseResults(100, mockPhases[1], false), { wrapper });

      await waitFor(() => {
        expect(result.current.shouldShowResults).toBe(true);
        expect(result.current.results).toEqual(mockResults);
        expect(result.current.previousPhaseId).toBe(1);
        expect(result.current.previousPhaseTitle).toBe('Investigation Phase');
      });
    });

    it('should not show results when previous phase is not action type', async () => {
      const phasesWithCommonRoom: GamePhase[] = [
        {
          ...mockPhases[0],
          phase_type: 'common_room',
        },
        mockPhases[1],
      ];

      vi.mocked(apiClient.phases.getGamePhases).mockResolvedValue({ data: phasesWithCommonRoom });
      vi.mocked(apiClient.phases.getUserResults).mockResolvedValue({ data: mockResults });

      const { result } = renderHook(() => usePreviousPhaseResults(100, phasesWithCommonRoom[1], false), { wrapper });

      await waitFor(() => {
        expect(result.current.shouldShowResults).toBe(false);
      });
    });

    it('should not show results when there are no published results', async () => {
      const unpublishedResults: ActionResult[] = [
        {
          ...mockResults[0],
          is_published: false,
        },
      ];

      vi.mocked(apiClient.phases.getGamePhases).mockResolvedValue({ data: mockPhases });
      vi.mocked(apiClient.phases.getUserResults).mockResolvedValue({ data: unpublishedResults });

      const { result } = renderHook(() => usePreviousPhaseResults(100, mockPhases[1], false), { wrapper });

      await waitFor(() => {
        expect(result.current.shouldShowResults).toBe(false);
      });
    });

    it('should not show results when there is a newer action phase between previous and current', async () => {
      const phasesWithNewerAction: GamePhase[] = [
        mockPhases[0], // Phase 1: action
        {
          id: 2,
          game_id: 100,
          phase_number: 2,
          phase_type: 'action',
          title: 'Second Investigation',
          description: 'More investigation',
          deadline: '2025-10-29T00:00:00Z',
          is_current: false,
          created_at: '2025-10-27T00:00:00Z',
          updated_at: '2025-10-27T00:00:00Z',
        }, // Phase 2: action
        mockPhases[1], // Phase 3: common_room (current)
      ];

      vi.mocked(apiClient.phases.getGamePhases).mockResolvedValue({ data: phasesWithNewerAction });
      vi.mocked(apiClient.phases.getUserResults).mockResolvedValue({ data: mockResults });

      const { result } = renderHook(() => usePreviousPhaseResults(100, phasesWithNewerAction[2], false), { wrapper });

      await waitFor(() => {
        expect(result.current.shouldShowResults).toBe(false);
      });
    });
  });

  describe('GM vs Player Endpoints', () => {
    it('should use getUserResults endpoint for players', async () => {
      vi.mocked(apiClient.phases.getGamePhases).mockResolvedValue({ data: mockPhases });
      vi.mocked(apiClient.phases.getUserResults).mockResolvedValue({ data: mockResults });

      renderHook(() => usePreviousPhaseResults(100, mockPhases[1], false), { wrapper });

      await waitFor(() => {
        expect(apiClient.phases.getUserResults).toHaveBeenCalledWith(100);
        expect(apiClient.phases.getGameResults).not.toHaveBeenCalled();
      });
    });

    it('should use getGameResults endpoint for GMs', async () => {
      vi.mocked(apiClient.phases.getGamePhases).mockResolvedValue({ data: mockPhases });
      vi.mocked(apiClient.phases.getGameResults).mockResolvedValue({ data: mockResults });

      renderHook(() => usePreviousPhaseResults(100, mockPhases[1], true), { wrapper });

      await waitFor(() => {
        expect(apiClient.phases.getGameResults).toHaveBeenCalledWith(100);
        expect(apiClient.phases.getUserResults).not.toHaveBeenCalled();
      });
    });
  });

  describe('Published Results Filter', () => {
    it('should filter and show only published results', async () => {
      const mixedResults: ActionResult[] = [
        mockResults[0], // published
        {
          ...mockResults[0],
          id: 2,
          is_published: false,
        }, // unpublished
        {
          ...mockResults[0],
          id: 3,
          phase_id: 1,
          is_published: true,
        }, // published
      ];

      vi.mocked(apiClient.phases.getGamePhases).mockResolvedValue({ data: mockPhases });
      vi.mocked(apiClient.phases.getUserResults).mockResolvedValue({ data: mixedResults });

      const { result } = renderHook(() => usePreviousPhaseResults(100, mockPhases[1], false), { wrapper });

      await waitFor(() => {
        expect(result.current.shouldShowResults).toBe(true);
        expect(result.current.results).toHaveLength(2);
        expect(result.current.results.every(r => r.is_published)).toBe(true);
      });
    });
  });

  describe('Phase Title Handling', () => {
    it('should use phase title when available', async () => {
      vi.mocked(apiClient.phases.getGamePhases).mockResolvedValue({ data: mockPhases });
      vi.mocked(apiClient.phases.getUserResults).mockResolvedValue({ data: mockResults });

      const { result } = renderHook(() => usePreviousPhaseResults(100, mockPhases[1], false), { wrapper });

      await waitFor(() => {
        expect(result.current.previousPhaseTitle).toBe('Investigation Phase');
      });
    });

    it('should generate title from phase number when title is missing', async () => {
      const phasesWithoutTitle: GamePhase[] = [
        {
          ...mockPhases[0],
          title: '',
        },
        mockPhases[1],
      ];

      vi.mocked(apiClient.phases.getGamePhases).mockResolvedValue({ data: phasesWithoutTitle });
      vi.mocked(apiClient.phases.getUserResults).mockResolvedValue({ data: mockResults });

      const { result } = renderHook(() => usePreviousPhaseResults(100, phasesWithoutTitle[1], false), { wrapper });

      await waitFor(() => {
        expect(result.current.previousPhaseTitle).toBe('Phase 1');
      });
    });
  });

  describe('Data Loading States', () => {
    it('should return default state when phases are still loading', async () => {
      vi.mocked(apiClient.phases.getGamePhases).mockImplementation(() => new Promise(() => {})); // Never resolves
      vi.mocked(apiClient.phases.getUserResults).mockResolvedValue({ data: mockResults });

      const { result } = renderHook(() => usePreviousPhaseResults(100, mockPhases[1], false), { wrapper });

      // Should return default state immediately
      expect(result.current.shouldShowResults).toBe(false);
      expect(result.current.results).toEqual([]);
    });

    it('should return default state when results are still loading', async () => {
      vi.mocked(apiClient.phases.getGamePhases).mockResolvedValue({ data: mockPhases });
      vi.mocked(apiClient.phases.getUserResults).mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => usePreviousPhaseResults(100, mockPhases[1], false), { wrapper });

      // Should return default state immediately
      expect(result.current.shouldShowResults).toBe(false);
      expect(result.current.results).toEqual([]);
    });
  });

  describe('Multiple Results Scenario', () => {
    it('should return all published results from previous action phase', async () => {
      const multipleResults: ActionResult[] = [
        mockResults[0],
        {
          ...mockResults[0],
          id: 2,
          user_id: 2,
          username: 'Player2',
          content: '# Another Result\n\nYou found something else.',
        },
        {
          ...mockResults[0],
          id: 3,
          user_id: 3,
          username: 'Player3',
          content: '# Third Result\n\nYet another discovery.',
        },
      ];

      vi.mocked(apiClient.phases.getGamePhases).mockResolvedValue({ data: mockPhases });
      vi.mocked(apiClient.phases.getUserResults).mockResolvedValue({ data: multipleResults });

      const { result } = renderHook(() => usePreviousPhaseResults(100, mockPhases[1], false), { wrapper });

      await waitFor(() => {
        expect(result.current.shouldShowResults).toBe(true);
        expect(result.current.results).toHaveLength(3);
        expect(result.current.results).toEqual(multipleResults);
      });
    });
  });
});
