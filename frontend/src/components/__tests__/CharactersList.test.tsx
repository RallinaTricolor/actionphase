import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test-utils'
import { CharactersList } from '../CharactersList'
import { http, HttpResponse } from 'msw'
import { server } from '../../mocks/server'
import type { Character } from '../../types/characters'

describe('CharactersList', () => {
  const mockCharacters: Character[] = [
    {
      id: 1,
      name: 'Hero Character',
      game_id: 123,
      user_id: 1,
      username: 'player1',
      character_type: 'player_character',
      status: 'approved',
      attributes: {},
      inventory: [],
      notes: '',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 2,
      name: 'Pending Character',
      game_id: 123,
      user_id: 2,
      username: 'player2',
      character_type: 'player_character',
      status: 'pending',
      attributes: {},
      inventory: [],
      notes: '',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 3,
      name: 'Villain NPC',
      game_id: 123,
      user_id: 1,
      username: 'gm',
      character_type: 'npc_gm',
      status: 'approved',
      attributes: {},
      inventory: [],
      notes: '',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    // Default API response - apiClient expects res.data to be the array directly
    server.use(
      http.get('http://localhost:3000/api/v1/games/:gameId/characters', () => {
        return HttpResponse.json(mockCharacters)
      })
    )
  })

  describe('Loading and empty states', () => {
    it('should show loading state initially', () => {
      server.use(
        http.get('http://localhost:3000/api/v1/games/:gameId/characters', async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
          return HttpResponse.json([])
        })
      )

      renderWithProviders(
        <CharactersList gameId={123} userRole="player" currentUserId={1} />
      )

      expect(screen.getByText('Characters')).toBeInTheDocument()
      // Check for loading skeleton
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('should show empty state when no characters exist', async () => {
      server.use(
        http.get('http://localhost:3000/api/v1/games/:gameId/characters', () => {
          return HttpResponse.json([])
        })
      )

      renderWithProviders(
        <CharactersList gameId={123} userRole="player" currentUserId={1} gameState="setup" />
      )

      await waitFor(() => {
        expect(screen.getByText('No characters created yet.')).toBeInTheDocument()
      })

      expect(screen.getByText(/Click "Create Character" to get started/)).toBeInTheDocument()
    })
  })

  describe('Character rendering', () => {
    it('should render character list when data is loaded', async () => {
      renderWithProviders(
        <CharactersList gameId={123} userRole="gm" currentUserId={1} />
      )

      await waitFor(() => {
        expect(screen.getByText('Hero Character')).toBeInTheDocument()
      })

      expect(screen.getByText('Pending Character')).toBeInTheDocument()
      expect(screen.getByText('Villain NPC')).toBeInTheDocument()
    })

    it('should group characters by type (Player Characters, GM NPCs)', async () => {
      renderWithProviders(
        <CharactersList gameId={123} userRole="gm" currentUserId={1} />
      )

      await waitFor(() => {
        expect(screen.getByText('Player Characters')).toBeInTheDocument()
      })

      expect(screen.getByText('GM NPCs')).toBeInTheDocument()
    })

    it('should display character status badges', async () => {
      renderWithProviders(
        <CharactersList gameId={123} userRole="gm" currentUserId={1} />
      )

      await waitFor(() => {
        expect(screen.getAllByText('approved').length).toBeGreaterThan(0)
      })

      expect(screen.getByText('pending')).toBeInTheDocument()
    })

    it('should show ownership badge for user characters', async () => {
      renderWithProviders(
        <CharactersList gameId={123} userRole="player" currentUserId={1} />
      )

      await waitFor(() => {
        expect(screen.getAllByText('Your Character').length).toBeGreaterThan(0)
      })
    })
  })

  describe('Role-based visibility (GM)', () => {
    it('GM should see all characters regardless of status', async () => {
      renderWithProviders(
        <CharactersList gameId={123} userRole="gm" currentUserId={1} />
      )

      await waitFor(() => {
        expect(screen.getByText('Hero Character')).toBeInTheDocument()
      })

      expect(screen.getByText('Pending Character')).toBeInTheDocument()
      expect(screen.getByText('Villain NPC')).toBeInTheDocument()
    })

    it('GM should see approve/reject buttons for pending characters', async () => {
      renderWithProviders(
        <CharactersList gameId={123} userRole="gm" currentUserId={1} />
      )

      await waitFor(() => {
        expect(screen.getByText('Approve')).toBeInTheDocument()
      })

      expect(screen.getByText('Reject')).toBeInTheDocument()
    })

    it('GM should NOT see approve/reject buttons for approved characters', async () => {
      server.use(
        http.get('http://localhost:3000/api/v1/games/:gameId/characters', () => {
          return HttpResponse.json([mockCharacters[0]]) // Only approved character
        })
      )

      renderWithProviders(
        <CharactersList gameId={123} userRole="gm" currentUserId={1} />
      )

      await waitFor(() => {
        expect(screen.getByText('Hero Character')).toBeInTheDocument()
      })

      expect(screen.queryByText('Approve')).not.toBeInTheDocument()
      expect(screen.queryByText('Reject')).not.toBeInTheDocument()
    })
  })

  describe('Role-based visibility (Player)', () => {
    it('Player should see approved characters and their own characters', async () => {
      renderWithProviders(
        <CharactersList gameId={123} userRole="player" currentUserId={1} />
      )

      await waitFor(() => {
        expect(screen.getByText('Hero Character')).toBeInTheDocument()
      })

      // Should NOT see other players' pending characters
      expect(screen.queryByText('Pending Character')).not.toBeInTheDocument()

      // Should see GM NPC (approved)
      expect(screen.getByText('Villain NPC')).toBeInTheDocument()
    })

    it('Player should NOT see approve/reject buttons', async () => {
      renderWithProviders(
        <CharactersList gameId={123} userRole="player" currentUserId={1} />
      )

      await waitFor(() => {
        expect(screen.getByText('Hero Character')).toBeInTheDocument()
      })

      expect(screen.queryByText('Approve')).not.toBeInTheDocument()
      expect(screen.queryByText('Reject')).not.toBeInTheDocument()
    })
  })

  describe('Create Character button', () => {
    it('should show create button for GM in setup state', async () => {
      renderWithProviders(
        <CharactersList gameId={123} userRole="gm" currentUserId={1} gameState="setup" />
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Create Character' })).toBeInTheDocument()
      })
    })

    it('should show create button for player in character_creation state', async () => {
      renderWithProviders(
        <CharactersList gameId={123} userRole="player" currentUserId={1} gameState="character_creation" />
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Create Character' })).toBeInTheDocument()
      })
    })

    it('should NOT show create button for player in active state', async () => {
      renderWithProviders(
        <CharactersList gameId={123} userRole="player" currentUserId={1} gameState="active" />
      )

      await waitFor(() => {
        expect(screen.getByText('Characters')).toBeInTheDocument()
      })

      expect(screen.queryByRole('button', { name: 'Create Character' })).not.toBeInTheDocument()
    })

    it('should NOT show create button in completed game', async () => {
      renderWithProviders(
        <CharactersList gameId={123} userRole="gm" currentUserId={1} gameState="completed" />
      )

      await waitFor(() => {
        expect(screen.getByText('Characters')).toBeInTheDocument()
      })

      expect(screen.queryByRole('button', { name: 'Create Character' })).not.toBeInTheDocument()
    })
  })

  describe('View/Edit Sheet permissions', () => {
    it('should show "Edit Sheet" button for user\'s own character', async () => {
      renderWithProviders(
        <CharactersList gameId={123} userRole="player" currentUserId={1} />
      )

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Edit Sheet' }).length).toBeGreaterThan(0)
      })
    })

    it('should show "View Sheet" button for other approved characters', async () => {
      renderWithProviders(
        <CharactersList gameId={123} userRole="player" currentUserId={999} />
      )

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'View Sheet' }).length).toBeGreaterThan(0)
      })
    })

    it('GM should be able to edit all character sheets', async () => {
      renderWithProviders(
        <CharactersList gameId={123} userRole="gm" currentUserId={999} />
      )

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Edit Sheet' }).length).toBeGreaterThan(0)
      })
    })
  })

  describe('Anonymous mode', () => {
    it('should hide ownership badges in anonymous mode', async () => {
      renderWithProviders(
        <CharactersList
          gameId={123}
          userRole="player"
          currentUserId={1}
          isAnonymous={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Hero Character')).toBeInTheDocument()
      })

      expect(screen.queryByText('Your Character')).not.toBeInTheDocument()
    })

    it('should hide character type in anonymous mode', async () => {
      renderWithProviders(
        <CharactersList
          gameId={123}
          userRole="player"
          currentUserId={1}
          isAnonymous={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Hero Character')).toBeInTheDocument()
      })

      expect(screen.queryByText(/Type:/)).not.toBeInTheDocument()
    })

    it('should NOT group by type in anonymous mode', async () => {
      renderWithProviders(
        <CharactersList
          gameId={123}
          userRole="player"
          currentUserId={1}
          isAnonymous={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Hero Character')).toBeInTheDocument()
      })

      expect(screen.queryByText('Player Characters')).not.toBeInTheDocument()
      expect(screen.queryByText('GM NPCs')).not.toBeInTheDocument()
    })

    it('GM should still see character details in anonymous mode', async () => {
      renderWithProviders(
        <CharactersList
          gameId={123}
          userRole="gm"
          currentUserId={1}
          isAnonymous={true}
        />
      )

      await waitFor(() => {
        expect(screen.getAllByText('Your Character').length).toBeGreaterThan(0)
      })

      expect(screen.getAllByText(/Type:/).length).toBeGreaterThan(0)
    })
  })

  describe('Character actions', () => {
    it('should call approve mutation when approve button is clicked', async () => {
      let approvePayload: any = null

      server.use(
        http.post('http://localhost:3000/api/v1/characters/:id/approve', async ({ request }) => {
          approvePayload = await request.json()
          return HttpResponse.json({ success: true })
        })
      )

      renderWithProviders(
        <CharactersList gameId={123} userRole="gm" currentUserId={1} />
      )

      await waitFor(() => {
        expect(screen.getByText('Approve')).toBeInTheDocument()
      })

      const approveButton = screen.getByText('Approve')
      fireEvent.click(approveButton)

      await waitFor(() => {
        expect(approvePayload).toEqual({ status: 'approved' })
      })
    })

    it('should call reject mutation when reject button is clicked', async () => {
      let rejectPayload: any = null

      server.use(
        http.post('http://localhost:3000/api/v1/characters/:id/approve', async ({ request }) => {
          rejectPayload = await request.json()
          return HttpResponse.json({ success: true })
        })
      )

      renderWithProviders(
        <CharactersList gameId={123} userRole="gm" currentUserId={1} />
      )

      await waitFor(() => {
        expect(screen.getByText('Reject')).toBeInTheDocument()
      })

      const rejectButton = screen.getByText('Reject')
      fireEvent.click(rejectButton)

      await waitFor(() => {
        expect(rejectPayload).toEqual({ status: 'rejected' })
      })
    })
  })

  describe('Status badges', () => {
    it('should show green badge for approved characters', async () => {
      renderWithProviders(
        <CharactersList gameId={123} userRole="gm" currentUserId={1} />
      )

      await waitFor(() => {
        const approvedBadge = screen.getAllByText('approved')[0]
        expect(approvedBadge).toHaveClass('bg-green-100', 'text-green-800')
      })
    })

    it('should show yellow badge for pending characters', async () => {
      renderWithProviders(
        <CharactersList gameId={123} userRole="gm" currentUserId={1} />
      )

      await waitFor(() => {
        const pendingBadge = screen.getByText('pending')
        expect(pendingBadge).toHaveClass('bg-yellow-100', 'text-yellow-800')
      })
    })
  })
})
