import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { DeleteAccountSection } from './DeleteAccountSection';
import { renderWithProviders } from '../test-utils/render';
import { server } from '../mocks/server';

// Mock useAuth to provide logout function (using importOriginal to keep AuthProvider)
const mockLogout = vi.fn();
vi.mock('../contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../contexts/AuthContext')>();
  return {
    ...actual,
    useAuth: () => ({
      user: { id: 1, username: 'testuser', email: 'test@example.com' },
      isAuthenticated: true,
      isLoading: false,
      isCheckingAuth: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: mockLogout,
      error: null,
    }),
  };
});

describe('DeleteAccountSection', () => {
  beforeEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
  });

  it('renders delete account section', () => {
    renderWithProviders(<DeleteAccountSection />);

    expect(screen.getByText('Delete Account')).toBeInTheDocument();
    expect(screen.getByText(/Permanently delete your account/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete My Account' })).toBeInTheDocument();
  });

  it('displays warning alert about 30-day restoration', () => {
    renderWithProviders(<DeleteAccountSection />);

    expect(screen.getByText(/Warning:/i)).toBeInTheDocument();
    expect(screen.getByText(/30 days to restore/i)).toBeInTheDocument();
  });

  it('shows confirmation dialog when delete button is clicked', async () => {
    renderWithProviders(<DeleteAccountSection />);

    const deleteButton = screen.getByRole('button', { name: 'Delete My Account' });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText(/Are you sure?/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Yes, Delete My Account' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    // Initial delete button should be hidden
    expect(screen.queryByRole('button', { name: 'Delete My Account' })).not.toBeInTheDocument();
  });

  it('cancels deletion when cancel button is clicked', async () => {
    renderWithProviders(<DeleteAccountSection />);

    const deleteButton = screen.getByRole('button', { name: 'Delete My Account' });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText(/Are you sure?/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete My Account' })).toBeInTheDocument();
    });
  });

  it('deletes account successfully and shows success toast', async () => {
    server.use(
      http.delete('http://localhost:3000/api/v1/auth/delete-account', async () => {
        return HttpResponse.json({ message: 'Account deleted successfully' });
      })
    );

    renderWithProviders(<DeleteAccountSection />);

    const deleteButton = screen.getByRole('button', { name: 'Delete My Account' });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Yes, Delete My Account' })).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: 'Yes, Delete My Account' });
    fireEvent.click(confirmButton);

    // Toast message should appear
    await waitFor(() => {
      expect(screen.getByText(/Account deleted successfully/i)).toBeInTheDocument();
      const elements = screen.getAllByText(/30 days to restore/i);
      expect(elements.length).toBeGreaterThan(0);
    });

    // Logout should not be called immediately (there's a 2-second delay)
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('shows error toast when deletion fails', async () => {
    server.use(
      http.delete('http://localhost:3000/api/v1/auth/delete-account', async () => {
        return HttpResponse.json(
          { error: 'Failed to delete account' },
          { status: 500 }
        );
      })
    );

    renderWithProviders(<DeleteAccountSection />);

    const deleteButton = screen.getByRole('button', { name: 'Delete My Account' });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Yes, Delete My Account' })).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: 'Yes, Delete My Account' });
    fireEvent.click(confirmButton);

    // Error toast should appear
    await waitFor(() => {
      expect(screen.getByText('Failed to delete account')).toBeInTheDocument();
    });

    // Confirmation dialog should be hidden
    await waitFor(() => {
      expect(screen.queryByText(/Are you sure?/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete My Account' })).toBeInTheDocument();
    });

    // Logout should not be called
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('disables buttons while deletion is in progress', async () => {
    server.use(
      http.delete('http://localhost:3000/api/v1/auth/delete-account', async () => {
        // Simulate slow API
        await new Promise(resolve => setTimeout(resolve, 200));
        return HttpResponse.json({ message: 'Account deleted successfully' });
      })
    );

    renderWithProviders(<DeleteAccountSection />);

    const deleteButton = screen.getByRole('button', { name: 'Delete My Account' });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Yes, Delete My Account' })).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: 'Yes, Delete My Account' });
    fireEvent.click(confirmButton);

    // Wait a bit and then check if cancel button is disabled
    await waitFor(() => {
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      expect(cancelButton).toBeDisabled();
    });

    await waitFor(() => {
      expect(screen.getByText(/Account deleted successfully/i)).toBeInTheDocument();
    });
  });

  it('shows generic error message when API error has no specific message', async () => {
    server.use(
      http.delete('http://localhost:3000/api/v1/auth/delete-account', async () => {
        return HttpResponse.json({}, { status: 500 });
      })
    );

    renderWithProviders(<DeleteAccountSection />);

    const deleteButton = screen.getByRole('button', { name: 'Delete My Account' });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Yes, Delete My Account' })).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: 'Yes, Delete My Account' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to delete account')).toBeInTheDocument();
    });
  });

  it('displays danger variant for delete button', () => {
    renderWithProviders(<DeleteAccountSection />);

    const deleteButton = screen.getByRole('button', { name: 'Delete My Account' });

    // Check if button has danger styling classes
    expect(deleteButton).toHaveClass('bg-semantic-danger');
  });

  it('displays danger variant for confirmation button', async () => {
    renderWithProviders(<DeleteAccountSection />);

    const deleteButton = screen.getByRole('button', { name: 'Delete My Account' });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      const confirmButton = screen.getByRole('button', { name: 'Yes, Delete My Account' });
      expect(confirmButton).toHaveClass('bg-semantic-danger');
    });
  });
});
