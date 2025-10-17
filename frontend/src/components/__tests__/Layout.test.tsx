import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, render, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Layout } from '../Layout'

// Mock the useAuth hook
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../../contexts/AuthContext'

describe('Layout', () => {
  const mockLogout = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('When user is authenticated', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        currentUser: { id: 1, username: 'testuser', email: 'test@example.com', created_at: '', updated_at: '' },
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: mockLogout,
        error: null,
      } as any)
    })

    it('should render navigation bar', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Layout>
            <div>Content</div>
          </Layout>
        </MemoryRouter>
      )

      expect(screen.getByRole('navigation')).toBeInTheDocument()
      expect(screen.getByText('ActionPhase')).toBeInTheDocument()
    })

    it('should render navigation links', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Layout>
            <div>Content</div>
          </Layout>
        </MemoryRouter>
      )

      expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Games' })).toBeInTheDocument()
    })

    it('should render logout button', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Layout>
            <div>Content</div>
          </Layout>
        </MemoryRouter>
      )

      expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument()
    })

    it('should highlight active dashboard link', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Layout>
            <div>Content</div>
          </Layout>
        </MemoryRouter>
      )

      const dashboardLink = screen.getByRole('link', { name: 'Dashboard' })
      expect(dashboardLink).toHaveClass('bg-indigo-700', 'text-white')
    })

    it('should highlight active games link', () => {
      render(
        <MemoryRouter initialEntries={['/games']}>
          <Layout>
            <div>Content</div>
          </Layout>
        </MemoryRouter>
      )

      const gamesLink = screen.getByRole('link', { name: 'Games' })
      expect(gamesLink).toHaveClass('bg-indigo-700', 'text-white')
    })

    it('should not highlight inactive links', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Layout>
            <div>Content</div>
          </Layout>
        </MemoryRouter>
      )

      const gamesLink = screen.getByRole('link', { name: 'Games' })
      expect(gamesLink).not.toHaveClass('bg-indigo-700')
      expect(gamesLink).toHaveClass('text-indigo-100')
    })

    it('should render children content', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Layout>
            <div data-testid="test-content">Test Content</div>
          </Layout>
        </MemoryRouter>
      )

      expect(screen.getByTestId('test-content')).toBeInTheDocument()
      expect(screen.getByText('Test Content')).toBeInTheDocument()
    })

    it('should render complex children', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Layout>
            <div>
              <h1>Page Title</h1>
              <p>Page content</p>
              <button>Action Button</button>
            </div>
          </Layout>
        </MemoryRouter>
      )

      expect(screen.getByRole('heading', { name: 'Page Title' })).toBeInTheDocument()
      expect(screen.getByText('Page content')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Action Button' })).toBeInTheDocument()
    })

    it('should render footer', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Layout>
            <div>Content</div>
          </Layout>
        </MemoryRouter>
      )

      expect(screen.getByText(/© 2025 ActionPhase/)).toBeInTheDocument()
      expect(screen.getByText(/collaborative role-playing platform/)).toBeInTheDocument()
    })

    it('should call logout when logout button is clicked', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Layout>
            <div>Content</div>
          </Layout>
        </MemoryRouter>
      )

      const logoutButton = screen.getByRole('button', { name: 'Logout' })
      fireEvent.click(logoutButton)

      expect(mockLogout).toHaveBeenCalledOnce()
    })

    it('should have correct link hrefs', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Layout>
            <div>Content</div>
          </Layout>
        </MemoryRouter>
      )

      const dashboardLink = screen.getByRole('link', { name: 'Dashboard' })
      const gamesLink = screen.getByRole('link', { name: 'Games' })

      expect(dashboardLink).toHaveAttribute('href', '/dashboard')
      expect(gamesLink).toHaveAttribute('href', '/games')
    })

    it('should render brand link to dashboard', () => {
      render(
        <MemoryRouter initialEntries={['/games']}>
          <Layout>
            <div>Content</div>
          </Layout>
        </MemoryRouter>
      )

      // There are two "ActionPhase" links - the brand and the dashboard link
      const brandLinks = screen.getAllByText('ActionPhase')
      expect(brandLinks.length).toBeGreaterThan(0)

      // The brand should be a link
      const brandLink = brandLinks[0].closest('a')
      expect(brandLink).toHaveAttribute('href', '/dashboard')
    })
  })

  describe('When user is NOT authenticated', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        currentUser: null,
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: mockLogout,
        error: null,
      } as any)
    })

    it('should NOT render navigation bar', () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <Layout>
            <div>Content</div>
          </Layout>
        </MemoryRouter>
      )

      expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
      expect(screen.queryByText('ActionPhase')).not.toBeInTheDocument()
    })

    it('should NOT render navigation links', () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <Layout>
            <div>Content</div>
          </Layout>
        </MemoryRouter>
      )

      expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Games' })).not.toBeInTheDocument()
    })

    it('should NOT render logout button', () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <Layout>
            <div>Content</div>
          </Layout>
        </MemoryRouter>
      )

      expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument()
    })

    it('should still render children content', () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <Layout>
            <div data-testid="test-content">Login Form</div>
          </Layout>
        </MemoryRouter>
      )

      expect(screen.getByTestId('test-content')).toBeInTheDocument()
      expect(screen.getByText('Login Form')).toBeInTheDocument()
    })

    it('should still render footer', () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <Layout>
            <div>Content</div>
          </Layout>
        </MemoryRouter>
      )

      expect(screen.getByText(/© 2025 ActionPhase/)).toBeInTheDocument()
    })
  })

  describe('Styling and structure', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        currentUser: { id: 1, username: 'testuser', email: 'test@example.com', created_at: '', updated_at: '' },
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: mockLogout,
        error: null,
      } as any)
    })

    it('should have proper layout structure', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Layout>
            <div>Content</div>
          </Layout>
        </MemoryRouter>
      )

      const layout = container.querySelector('.min-h-screen.bg-gray-50')
      expect(layout).toBeInTheDocument()
    })

    it('should have navigation with proper styling', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Layout>
            <div>Content</div>
          </Layout>
        </MemoryRouter>
      )

      const nav = container.querySelector('.bg-indigo-600.shadow-lg')
      expect(nav).toBeInTheDocument()
    })

    it('should have main content wrapper', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Layout>
            <div data-testid="content">Content</div>
          </Layout>
        </MemoryRouter>
      )

      const main = screen.getByTestId('content').closest('main')
      expect(main).toBeInTheDocument()
      expect(main).toHaveClass('py-6')
    })

    it('should have footer with border', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Layout>
            <div>Content</div>
          </Layout>
        </MemoryRouter>
      )

      const footer = container.querySelector('footer.border-t.border-gray-200')
      expect(footer).toBeInTheDocument()
    })
  })

  describe('Edge cases', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        currentUser: { id: 1, username: 'testuser', email: 'test@example.com', created_at: '', updated_at: '' },
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: mockLogout,
        error: null,
      } as any)
    })

    it('should handle empty children', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Layout>
            <></>
          </Layout>
        </MemoryRouter>
      )

      expect(container.querySelector('main')).toBeInTheDocument()
    })

    it('should handle null children', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Layout>
            {null}
          </Layout>
        </MemoryRouter>
      )

      expect(container.querySelector('main')).toBeInTheDocument()
    })

    it('should handle route that is not dashboard or games', () => {
      render(
        <MemoryRouter initialEntries={['/profile']}>
          <Layout>
            <div>Profile Content</div>
          </Layout>
        </MemoryRouter>
      )

      // Both links should be inactive
      const dashboardLink = screen.getByRole('link', { name: 'Dashboard' })
      const gamesLink = screen.getByRole('link', { name: 'Games' })

      expect(dashboardLink).not.toHaveClass('bg-indigo-700')
      expect(gamesLink).not.toHaveClass('bg-indigo-700')
      expect(dashboardLink).toHaveClass('text-indigo-100')
      expect(gamesLink).toHaveClass('text-indigo-100')
    })
  })

  describe('Accessibility', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        currentUser: { id: 1, username: 'testuser', email: 'test@example.com', created_at: '', updated_at: '' },
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: mockLogout,
        error: null,
      } as any)
    })

    it('should have semantic nav element', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Layout>
            <div>Content</div>
          </Layout>
        </MemoryRouter>
      )

      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })

    it('should have semantic main element', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Layout>
            <div>Content</div>
          </Layout>
        </MemoryRouter>
      )

      expect(screen.getByRole('main')).toBeInTheDocument()
    })

    it('should have navigation links with proper role', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Layout>
            <div>Content</div>
          </Layout>
        </MemoryRouter>
      )

      const links = screen.getAllByRole('link')
      expect(links.length).toBeGreaterThan(0)
    })

    it('should have logout button with proper role', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Layout>
            <div>Content</div>
          </Layout>
        </MemoryRouter>
      )

      const button = screen.getByRole('button', { name: 'Logout' })
      expect(button).toBeInTheDocument()
      expect(button).toBeEnabled()
    })
  })
})
