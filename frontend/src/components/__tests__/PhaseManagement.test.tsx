import { describe, it, expect, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent as _fireEvent } from '@testing-library/react'
import { http, HttpResponse as _HttpResponse } from 'msw'
import { PhaseManagement } from '../PhaseManagement'
import { renderWithProviders } from '../../test-utils/render'
import { server } from '../../mocks/server'
import type { GamePhase } from '../../types/phases'

describe('PhaseManagement', () => {
  const mockPhases: GamePhase[] = [
    {
      id: 1,
      game_id: 1,
      phase_number: 1,
      phase_type: 'common_room',
      title: 'Opening Discussion',
      description: 'Players discuss their plans',
      deadline: '2025-12-31T23:59:59Z',
      is_active: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 2,
      game_id: 1,
      phase_number: 2,
      phase_type: 'action',
      title: 'First Action Phase',
      description: 'Submit your actions',
      deadline: '2026-01-15T23:59:59Z',
      is_active: false,
      created_at: '2025-01-02T00:00:00Z',
      updated_at: '2025-01-02T00:00:00Z',
    },
  ]

  const setupDefaultHandlers = (
    phases: GamePhase[] = mockPhases,
    currentPhase: GamePhase | null = mockPhases[0]
  ) => {
    server.use(
      http.get('/api/v1/games/:gameId/phases', () => {
        return HttpResponse.json(phases)
      }),
      http.get('/api/v1/games/:gameId/current-phase', () => {
        if (currentPhase) {
          return HttpResponse.json({ phase: currentPhase })
        }
        return HttpResponse.json({ phase: null })
      }),
      http.post('/api/v1/games/:gameId/phases', async () => {
        return HttpResponse.json({
          id: 3,
          game_id: 1,
          phase_number: 3,
          phase_type: 'action',
          is_active: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { status: 201 })
      }),
      http.post('/api/v1/phases/:phaseId/activate', () => {
        return HttpResponse.json({ success: true })
      }),
      http.patch('/api/v1/phases/:phaseId/deadline', () => {
        return HttpResponse.json({ success: true })
      }),
      http.put('/api/v1/phases/:phaseId', () => {
        return HttpResponse.json({ success: true })
      }),
      http.get('/api/v1/games/:gameId/phases/:phaseId/results/unpublished-count', () => {
        return HttpResponse.json({ count: 0 })
      })
    )
  }

  beforeEach(() => {
    server.resetHandlers()
    vi.clearAllMocks()
  })

  describe('Loading State', () => {
    it('should show loading skeleton while fetching phases', () => {
      // Don't set up handlers so queries remain in loading state
      renderWithProviders(<PhaseManagement gameId={1} />)

      // Loading state shows skeleton placeholders
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  describe('Empty State', () => {
    it('should show empty state when no phases exist', async () => {
      setupDefaultHandlers([], null)

      renderWithProviders(<PhaseManagement gameId={1} />)

      await waitFor(() => {
        expect(screen.getByText('No phases created yet')).toBeInTheDocument()
      })
    })
  })

  describe('Phase Display', () => {
    it('should display list of phases', async () => {
      setupDefaultHandlers()

      renderWithProviders(<PhaseManagement gameId={1} />)

      await waitFor(() => {
        expect(screen.getAllByText('Common Room')[0]).toBeInTheDocument()
        expect(screen.getAllByText('Action Phase')[0]).toBeInTheDocument()
        expect(screen.getAllByText('Phase 1')[0]).toBeInTheDocument()
        expect(screen.getAllByText('Phase 2')[0]).toBeInTheDocument()
      })
    })

    it('should show current active phase in summary section', async () => {
      setupDefaultHandlers()

      renderWithProviders(<PhaseManagement gameId={1} />)

      await waitFor(() => {
        const activeTexts = screen.getAllByText('Currently Active')
        expect(activeTexts.length).toBeGreaterThan(0)
        // Mock data has title "Opening Discussion" with phase_number 1
        expect(screen.getByText(/Opening Discussion \(Phase 1\)/i)).toBeInTheDocument()
      })
    })

    it('should show currently active indicator on active phase card', async () => {
      setupDefaultHandlers()

      renderWithProviders(<PhaseManagement gameId={1} />)

      await waitFor(() => {
        const activeIndicators = screen.getAllByText('Currently Active')
        // One in summary, one in phase card
        expect(activeIndicators.length).toBe(2)
      })
    })
  })

  describe('Create Phase Modal', () => {
    it('should open create phase modal when New Phase button clicked', async () => {
      setupDefaultHandlers()

      renderWithProviders(<PhaseManagement gameId={1} />)

      await waitFor(() => {
        expect(screen.getAllByText('Common Room')[0]).toBeInTheDocument()
      })

      const newPhaseButton = screen.getByRole('button', { name: /new phase/i })
      fireEvent.click(newPhaseButton)

      await waitFor(() => {
        expect(screen.getByText('Create New Phase')).toBeInTheDocument()
        expect(screen.getByLabelText(/phase type/i)).toBeInTheDocument()
      })
    })

    it('should close create phase modal when cancel clicked', async () => {
      setupDefaultHandlers()

      renderWithProviders(<PhaseManagement gameId={1} />)

      await waitFor(() => {
        expect(screen.getAllByText('Common Room')[0]).toBeInTheDocument()
      })

      const newPhaseButton = screen.getByRole('button', { name: /new phase/i })
      fireEvent.click(newPhaseButton)

      await waitFor(() => {
        expect(screen.getByText('Create New Phase')).toBeInTheDocument()
      })

      const cancelButtons = screen.getAllByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButtons[0])

      await waitFor(() => {
        expect(screen.queryByText('Create New Phase')).not.toBeInTheDocument()
      })
    })

    it('should allow selecting phase type', async () => {
      setupDefaultHandlers()

      renderWithProviders(<PhaseManagement gameId={1} />)

      const newPhaseButton = await screen.findByRole('button', { name: /new phase/i })
      fireEvent.click(newPhaseButton)

      const phaseTypeSelect = await screen.findByLabelText(/phase type/i)
      expect(phaseTypeSelect).toHaveValue('common_room')

      fireEvent.change(phaseTypeSelect, { target: { value: 'action' } })
      expect(phaseTypeSelect).toHaveValue('action')
    })

    it('should submit create phase form', async () => {
      setupDefaultHandlers()

      renderWithProviders(<PhaseManagement gameId={1} />)

      const newPhaseButton = await screen.findByRole('button', { name: /new phase/i })
      fireEvent.click(newPhaseButton)

      const phaseTypeSelect = await screen.findByLabelText(/phase type/i)
      fireEvent.change(phaseTypeSelect, { target: { value: 'action' } })

      const titleInput = screen.getByPlaceholderText(/gathering storm/i)
      fireEvent.change(titleInput, { target: { value: 'Test Phase' } })

      const createButton = screen.getByRole('button', { name: /create phase/i })
      fireEvent.click(createButton)

      await waitFor(() => {
        expect(screen.queryByText('Create New Phase')).not.toBeInTheDocument()
      })
    })
  })

  describe('Phase Activation', () => {
    it('should show activate button on inactive phases', async () => {
      setupDefaultHandlers()

      renderWithProviders(<PhaseManagement gameId={1} />)

      await waitFor(() => {
        expect(screen.getAllByText('Action Phase')[0]).toBeInTheDocument()
      })

      // Find activate button (should only be on inactive phase × 2 for dual-DOM)
      const activateButtons = screen.getAllByRole('button', { name: /^activate$/i })
      expect(activateButtons.length).toBe(2)
    })

    it('should show confirmation dialog when activate clicked', async () => {
      setupDefaultHandlers()

      renderWithProviders(<PhaseManagement gameId={1} />)

      await waitFor(() => {
        expect(screen.getAllByText('Action Phase')[0]).toBeInTheDocument()
      })

      const activateButton = screen.getAllByRole('button', { name: /^activate$/i })[0]
      fireEvent.click(activateButton)

      await waitFor(() => {
        expect(screen.getByText(/Activate Phase 2\?/i)).toBeInTheDocument()
      })
    })

    it('should activate phase when confirmed', async () => {
      setupDefaultHandlers()

      renderWithProviders(<PhaseManagement gameId={1} />)

      await waitFor(() => {
        expect(screen.getAllByText('Action Phase')[0]).toBeInTheDocument()
      })

      const activateButton = screen.getAllByRole('button', { name: /^activate$/i })[0]
      fireEvent.click(activateButton)

      await waitFor(() => {
        expect(screen.getByText(/Activate Phase 2\?/i)).toBeInTheDocument()
      })

      const confirmButton = screen.getByRole('button', { name: /^activate phase$/i })
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(screen.queryByText(/Activate Phase 2\?/i)).not.toBeInTheDocument()
      })
    })

    it('should show unpublished results warning when activating', async () => {
      setupDefaultHandlers()
      server.use(
        http.get('/api/v1/games/:gameId/phases/:phaseId/results/unpublished-count', () => {
          return HttpResponse.json({ count: 3 })
        })
      )

      renderWithProviders(<PhaseManagement gameId={1} />)

      await waitFor(() => {
        expect(screen.getAllByText('Action Phase')[0]).toBeInTheDocument()
      })

      const activateButton = screen.getAllByRole('button', { name: /^activate$/i })[0]
      fireEvent.click(activateButton)

      await waitFor(() => {
        expect(screen.getByText(/You have 3 unpublished results/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /publish & activate phase/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /activate without publishing/i })).toBeInTheDocument()
      })
    })
  })

  describe('Edit Phase', () => {
    it('should show edit button on phase cards', async () => {
      setupDefaultHandlers()

      renderWithProviders(<PhaseManagement gameId={1} />)

      await waitFor(() => {
        expect(screen.getAllByText('Common Room')[0]).toBeInTheDocument()
      })

      const editButtons = screen.getAllByTitle(/edit phase details/i)
      expect(editButtons.length).toBe(4) // One for each phase × 2 (dual-DOM)
    })

    it('should open edit modal when edit button clicked', async () => {
      setupDefaultHandlers()

      renderWithProviders(<PhaseManagement gameId={1} />)

      await waitFor(() => {
        expect(screen.getAllByText('Common Room')[0]).toBeInTheDocument()
      })

      const editButtons = screen.getAllByTitle(/edit phase details/i)
      fireEvent.click(editButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Edit Phase')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Opening Discussion')).toBeInTheDocument()
      })
    })

    it('should submit edit phase form', async () => {
      setupDefaultHandlers()

      renderWithProviders(<PhaseManagement gameId={1} />)

      await waitFor(() => {
        expect(screen.getAllByText('Common Room')[0]).toBeInTheDocument()
      })

      const editButtons = screen.getAllByTitle(/edit phase details/i)
      fireEvent.click(editButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Edit Phase')).toBeInTheDocument()
      })

      const titleInput = screen.getByDisplayValue('Opening Discussion')
      fireEvent.change(titleInput, { target: { value: 'Updated Title' } })

      const saveButton = screen.getByRole('button', { name: /save changes/i })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.queryByText('Edit Phase')).not.toBeInTheDocument()
      })
    })
  })

  describe('Phase Information Display', () => {
    it('should display phase descriptions', async () => {
      setupDefaultHandlers()

      renderWithProviders(<PhaseManagement gameId={1} />)

      await waitFor(() => {
        expect(screen.getAllByText('Players discuss their plans')[0]).toBeInTheDocument()
        expect(screen.getAllByText('Submit your actions')[0]).toBeInTheDocument()
      })
    })

    it('should display phase type labels correctly', async () => {
      setupDefaultHandlers()

      renderWithProviders(<PhaseManagement gameId={1} />)

      await waitFor(() => {
        // Check that phase numbers are displayed
        expect(screen.getAllByText('Phase 1')[0]).toBeInTheDocument()
        expect(screen.getAllByText('Phase 2')[0]).toBeInTheDocument()
      })
    })
  })

  describe('Component Props', () => {
    it('should apply custom className', () => {
      setupDefaultHandlers()

      const { container: _container } = renderWithProviders(
        <PhaseManagement gameId={1} className="custom-class" />
      )

      const phaseManagement = container.querySelector('.custom-class')
      expect(phaseManagement).toBeInTheDocument()
    })

    it('should work with different gameId', async () => {
      server.use(
        http.get('/api/v1/games/:gameId/phases', ({ params }) => {
          expect(params.gameId).toBe('999')
          return HttpResponse.json([])
        }),
        http.get('/api/v1/games/:gameId/current-phase', () => {
          return HttpResponse.json({ phase: null })
        })
      )

      renderWithProviders(<PhaseManagement gameId={999} />)

      await waitFor(() => {
        expect(screen.getByText('No phases created yet')).toBeInTheDocument()
      })
    })
  })
})
