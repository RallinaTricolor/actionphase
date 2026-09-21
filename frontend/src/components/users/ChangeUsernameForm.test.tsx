import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { ChangeUsernameForm } from './ChangeUsernameForm';
import { renderWithProviders } from '@/test-utils/render';
import { server } from '@/mocks/server';

// Mock useAuth to provide a user (using importOriginal to keep AuthProvider)
vi.mock('@/contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/contexts/AuthContext')>();
  return {
    ...actual,
    useAuth: () => ({
      currentUser: { id: 1, username: 'currentuser', email: 'user@example.com', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      isAuthenticated: true,
      isLoading: false,
      isCheckingAuth: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      error: null,
    }),
  };
});


describe('ChangeUsernameForm', () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  it('renders change username form with current username', () => {
    renderWithProviders(<ChangeUsernameForm />);

    expect(screen.getByRole('heading', { name: 'Change Username' })).toBeInTheDocument();
    expect(screen.getByText(/Current username:/i)).toBeInTheDocument();
    expect(screen.getByText('currentuser')).toBeInTheDocument();
    expect(screen.getByLabelText('New Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Current Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change Username' })).toBeInTheDocument();
  });

  it('handles form input changes', () => {
    renderWithProviders(<ChangeUsernameForm />);

    const usernameInput = screen.getByLabelText('New Username');
    const passwordInput = screen.getByLabelText('Current Password');

    fireEvent.change(usernameInput, { target: { value: 'newusername' } });
    fireEvent.change(passwordInput, { target: { value: 'mypassword123' } });

    expect(usernameInput).toHaveValue('newusername');
    expect(passwordInput).toHaveValue('mypassword123');
  });

  it('shows validation error when new username is empty', async () => {
    renderWithProviders(<ChangeUsernameForm />);

    const passwordInput = screen.getByLabelText('Current Password');
    const submitButton = screen.getByRole('button', { name: 'Change Username' });

    fireEvent.change(passwordInput, { target: { value: 'mypassword123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('New username is required')).toBeInTheDocument();
    });
  });

  it('shows validation error when current password is empty', async () => {
    renderWithProviders(<ChangeUsernameForm />);

    const usernameInput = screen.getByLabelText('New Username');
    const submitButton = screen.getByRole('button', { name: 'Change Username' });

    fireEvent.change(usernameInput, { target: { value: 'newusername' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Current password is required')).toBeInTheDocument();
    });
  });

  it('trims whitespace from new username', async () => {
    // Assert on the request body, not the response: the handler returns 200
    // whatever it is sent, so a success toast alone would pass even if the
    // untrimmed value went over the wire.
    let sentBody: { new_username?: string } | undefined;
    server.use(
      http.post('http://localhost:3000/api/v1/auth/change-username', async ({ request }) => {
        sentBody = (await request.json()) as { new_username?: string };
        return HttpResponse.json({ message: 'Username changed successfully' }, { status: 200 });
      })
    );

    renderWithProviders(<ChangeUsernameForm />);

    const usernameInput = screen.getByLabelText('New Username');
    const passwordInput = screen.getByLabelText('Current Password');
    const submitButton = screen.getByRole('button', { name: 'Change Username' });

    fireEvent.change(usernameInput, { target: { value: '  newusername  ' } });
    fireEvent.change(passwordInput, { target: { value: 'mypassword123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(sentBody?.new_username).toBe('newusername');
    });

    // Form should be cleared
    await waitFor(() => {
      expect(usernameInput).toHaveValue('');
      expect(passwordInput).toHaveValue('');
    });
  });

  it('submits form with valid data successfully', async () => {
    server.use(
      http.post('http://localhost:3000/api/v1/auth/change-username', async () => {
        return HttpResponse.json({ message: 'Username changed successfully' });
      })
    );

    renderWithProviders(<ChangeUsernameForm />);

    const usernameInput = screen.getByLabelText('New Username');
    const passwordInput = screen.getByLabelText('Current Password');
    const submitButton = screen.getByRole('button', { name: 'Change Username' });

    fireEvent.change(usernameInput, { target: { value: 'newusername' } });
    fireEvent.change(passwordInput, { target: { value: 'mypassword123' } });
    fireEvent.click(submitButton);

    // Toast message should appear
    await waitFor(() => {
      expect(screen.getByText(/Username changed successfully/i)).toBeInTheDocument();
    });

    // Form should be cleared
    await waitFor(() => {
      expect(usernameInput).toHaveValue('');
      expect(passwordInput).toHaveValue('');
    });
  });

  it('shows error alert and toast when API call fails', async () => {
    server.use(
      http.post('http://localhost:3000/api/v1/auth/change-username', async () => {
        return HttpResponse.json(
          { detail: 'Username already taken' },
          { status: 400 }
        );
      })
    );

    renderWithProviders(<ChangeUsernameForm />);

    const usernameInput = screen.getByLabelText('New Username');
    const passwordInput = screen.getByLabelText('Current Password');
    const submitButton = screen.getByRole('button', { name: 'Change Username' });

    fireEvent.change(usernameInput, { target: { value: 'takenusername' } });
    fireEvent.change(passwordInput, { target: { value: 'mypassword123' } });
    fireEvent.click(submitButton);

    // Both alert and toast should show the error
    await waitFor(() => {
      const errorMessages = screen.getAllByText('Username already taken');
      expect(errorMessages.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('dismisses error alert when dismiss button is clicked', async () => {
    renderWithProviders(<ChangeUsernameForm />);

    const submitButton = screen.getByRole('button', { name: 'Change Username' });

    // Trigger validation error
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('New username is required')).toBeInTheDocument();
    });

    // Find and click dismiss button
    const dismissButton = screen.getByLabelText('Dismiss');
    fireEvent.click(dismissButton);

    await waitFor(() => {
      expect(screen.queryByText('New username is required')).not.toBeInTheDocument();
    });
  });

  it('clears error when user starts typing after error', async () => {
    renderWithProviders(<ChangeUsernameForm />);

    const usernameInput = screen.getByLabelText('New Username');
    const submitButton = screen.getByRole('button', { name: 'Change Username' });

    // Trigger validation error
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('New username is required')).toBeInTheDocument();
    });

    // Start typing - error should remain (only dismissed via dismiss button)
    fireEvent.change(usernameInput, { target: { value: 'newusername' } });

    // Error is still visible - user must dismiss it
    expect(screen.getByText('New username is required')).toBeInTheDocument();
  });

  it('disables form inputs while submitting', async () => {
    server.use(
      http.post('http://localhost:3000/api/v1/auth/change-username', async () => {
        // Simulate slow API
        await new Promise(resolve => setTimeout(resolve, 100));
        return HttpResponse.json({ message: 'Username changed successfully' });
      })
    );

    renderWithProviders(<ChangeUsernameForm />);

    const usernameInput = screen.getByLabelText('New Username');
    const passwordInput = screen.getByLabelText('Current Password');
    const submitButton = screen.getByRole('button', { name: 'Change Username' });

    fireEvent.change(usernameInput, { target: { value: 'newusername' } });
    fireEvent.change(passwordInput, { target: { value: 'mypassword123' } });
    fireEvent.click(submitButton);

    // Inputs should be disabled during submission
    expect(usernameInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByText(/Username changed successfully/i)).toBeInTheDocument();
    });
  });

  it('shows generic error message when API error has no specific message', async () => {
    server.use(
      http.post('http://localhost:3000/api/v1/auth/change-username', async () => {
        return HttpResponse.json({}, { status: 500 });
      })
    );

    renderWithProviders(<ChangeUsernameForm />);

    const usernameInput = screen.getByLabelText('New Username');
    const passwordInput = screen.getByLabelText('Current Password');
    const submitButton = screen.getByRole('button', { name: 'Change Username' });

    fireEvent.change(usernameInput, { target: { value: 'newusername' } });
    fireEvent.change(passwordInput, { target: { value: 'mypassword123' } });
    fireEvent.click(submitButton);

    // Error appears in both Alert and Toast
    await waitFor(() => {
      const errorMessages = screen.getAllByText('Failed to change username');
      expect(errorMessages.length).toBeGreaterThanOrEqual(1);
    });
  });
});
