import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { SessionExpiredModal } from '../SessionExpiredModal'
import { renderWithProviders } from '../../test-utils/render'
import { server } from '../../mocks/server'

describe('SessionExpiredModal', () => {
  beforeEach(() => {
    server.resetHandlers()
    localStorage.clear()
  })

  it('renders when open', () => {
    renderWithProviders(<SessionExpiredModal isOpen={true} onSuccess={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Session Expired' })).toBeInTheDocument()
    expect(screen.getByText(/your session has expired/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    renderWithProviders(<SessionExpiredModal isOpen={false} onSuccess={vi.fn()} />)

    expect(screen.queryByRole('heading', { name: 'Session Expired' })).not.toBeInTheDocument()
  })

  it('has no close button — modal is forced', () => {
    renderWithProviders(<SessionExpiredModal isOpen={true} onSuccess={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument()
  })

  it('does not show the forgot password link', () => {
    renderWithProviders(<SessionExpiredModal isOpen={true} onSuccess={vi.fn()} />)

    expect(screen.queryByText(/forgot password/i)).not.toBeInTheDocument()
  })

  it('tells the user their work is preserved', () => {
    renderWithProviders(<SessionExpiredModal isOpen={true} onSuccess={vi.fn()} />)

    expect(screen.getByText(/your work on this page has been preserved/i)).toBeInTheDocument()
  })

  it('calls onSuccess after successful re-authentication', async () => {
    const onSuccess = vi.fn()

    server.use(
      http.post('/api/v1/auth/login', () => {
        return HttpResponse.json({
          user: { id: 1, username: 'testuser', email: 'test@example.com' },
          Token: 'mock-jwt-token',
        })
      }),
      http.get('/api/v1/auth/me', () => {
        return HttpResponse.json({ id: 1, username: 'testuser', email: 'test@example.com' })
      })
    )

    renderWithProviders(<SessionExpiredModal isOpen={true} onSuccess={onSuccess} />)

    fireEvent.change(screen.getByLabelText('Username or Email'), {
      target: { value: 'testuser' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledOnce()
    }, { timeout: 3000 })
  })

  it('does not call onSuccess when login fails', async () => {
    const onSuccess = vi.fn()

    server.use(
      http.post('/api/v1/auth/login', () => {
        return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      })
    )

    renderWithProviders(<SessionExpiredModal isOpen={true} onSuccess={onSuccess} />)

    fireEvent.change(screen.getByLabelText('Username or Email'), {
      target: { value: 'wronguser' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrongpass' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    expect(onSuccess).not.toHaveBeenCalled()
  })
})
