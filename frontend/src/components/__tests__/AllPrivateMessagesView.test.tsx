import { describe, it, expect, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { AllPrivateMessagesView } from '../AllPrivateMessagesView'
import { renderWithProviders } from '../../test-utils/render'
import { server } from '../../mocks/server'

const gameId = 1

// Simulate the participants endpoint:
// - No selection: Alpha, Beta, Gamma all appear (all have conversations)
// - Alpha selected: Alpha, Beta, Gamma (both co-appear with Alpha)
// - Beta selected: Alpha, Beta only (Gamma has no conversation with Beta)
function participantsHandler(selected: string[]) {
  if (selected.length === 0) return ['Alpha', 'Beta', 'Gamma']
  if (selected.includes('Beta')) return ['Alpha', 'Beta']
  return ['Alpha', 'Beta', 'Gamma']
}

beforeEach(() => {
  server.use(
    http.get('/api/v1/games/:gameId/private-messages/participants', ({ request }) => {
      const url = new URL(request.url)
      const selected = url.searchParams.getAll('selected[]')
      return HttpResponse.json({ participants: participantsHandler(selected) })
    }),
    http.get('/api/v1/games/:gameId/private-messages/all', () => {
      return HttpResponse.json({ conversations: [], total: 0 })
    }),
    http.get('/api/v1/games/:gameId/characters', () => HttpResponse.json([])),
    http.get('/api/v1/games/:gameId/characters/controllable', () => HttpResponse.json([])),
    http.get('/api/v1/games/:gameId', () => HttpResponse.json({
      id: gameId, title: 'Test Game', state: 'in_progress',
      gm_user_id: 99, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })),
    http.get('/api/v1/games/:gameId/participants', () => HttpResponse.json([])),
    http.get('/api/v1/games/:gameId/current-phase', () => HttpResponse.json(null, { status: 404 })),
  )
})

describe('AllPrivateMessagesView - participant filter', () => {
  it('shows all conversation participants as filter options on initial load', async () => {
    renderWithProviders(<AllPrivateMessagesView gameId={gameId} />, { gameId })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Beta' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Gamma' })).toBeInTheDocument()
    })
  })

  it('narrows filter options to co-participants when a name is selected', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AllPrivateMessagesView gameId={gameId} />, { gameId })

    // Wait for initial filter list
    await waitFor(() => expect(screen.getByRole('button', { name: 'Beta' })).toBeInTheDocument())

    // Select Beta — Gamma should disappear (no shared conversation with Beta)
    await user.click(screen.getByRole('button', { name: 'Beta' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Beta' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Gamma' })).not.toBeInTheDocument()
    })
  })
})
