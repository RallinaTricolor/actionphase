import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ProfileSection } from './ProfileSection';
import * as AuthContextModule from '../contexts/AuthContext' // eslint-disable-line
import * as ToastContextModule from '../contexts/ToastContext' // eslint-disable-line
import type { User } from '../types/auth';

const mockUser: User = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  display_name: 'Test User',
  bio: 'My test bio',
  avatar_url: 'http://localhost:3000/uploads/avatar.jpg',
  created_at: '2024-01-01T00:00:00Z',
  timezone: 'America/New_York',
  is_admin: false,
};

const mockUseAuth = vi.fn();
const mockUseToast = vi.fn();

// Mock the hooks
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => mockUseToast(),
}));

const renderWithProviders = (user: User | null = mockUser) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  // Set up mock return values
  mockUseAuth.mockReturnValue({
    currentUser: user,
    isCheckingAuth: false,
  });

  mockUseToast.mockReturnValue({
    showToast: vi.fn(),
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ProfileSection />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('ProfileSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders profile section with heading', () => {
    renderWithProviders();
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('displays link to view public profile', () => {
    renderWithProviders();

    const link = screen.getByRole('link', { name: /View Public Profile/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/users/testuser');
  });

  it('displays user avatar when avatar_url is provided', () => {
    renderWithProviders();

    const avatar = screen.getByAltText('Profile avatar');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('src', 'http://localhost:3000/uploads/avatar.jpg');
  });

  it('displays fallback avatar with initials when no avatar_url', () => {
    const userWithoutAvatar = { ...mockUser, avatar_url: null };
    renderWithProviders(userWithoutAvatar);

    // Should show initials for username "testuser" -> "T"
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('displays Delete Avatar button when user has avatar', () => {
    renderWithProviders();

    expect(screen.getByRole('button', { name: /Delete Avatar/i })).toBeInTheDocument();
  });

  it('does not display Delete Avatar button when user has no avatar', () => {
    const userWithoutAvatar = { ...mockUser, avatar_url: null };
    renderWithProviders(userWithoutAvatar);

    expect(screen.queryByRole('button', { name: /Delete Avatar/i })).not.toBeInTheDocument();
  });

  it('displays bio textarea with current bio value', () => {
    renderWithProviders();

    const textarea = screen.getByPlaceholderText(/Tell us about yourself/i);
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue('My test bio');
  });

  it('allows editing bio text', async () => {
    const _user = userEvent.setup();
    renderWithProviders();

    const textarea = screen.getByPlaceholderText(/Tell us about yourself/i);
    await user.clear(textarea);
    await user.type(textarea, 'Updated bio text');

    expect(textarea).toHaveValue('Updated bio text');
  });

  it('does not show Save Bio button when no changes', () => {
    renderWithProviders();

    // Button should not be visible when bio hasn't changed
    const saveButton = screen.queryByRole('button', { name: /Save Bio/i });
    expect(saveButton).not.toBeInTheDocument();
  });

  it('shows Save Bio button when bio is modified', async () => {
    const _user = userEvent.setup();
    renderWithProviders();

    const textarea = screen.getByPlaceholderText(/Tell us about yourself/i);
    await user.type(textarea, ' additional text');

    // Button should appear when changes are made
    const saveButton = await screen.findByRole('button', { name: /Save Bio/i });
    expect(saveButton).toBeInTheDocument();
    expect(saveButton).toBeEnabled();
  });

  it('displays avatar upload section', () => {
    renderWithProviders();

    expect(screen.getByText('Avatar')).toBeInTheDocument();
    // File input exists
    const fileInputs = document.querySelectorAll('input[type="file"]');
    expect(fileInputs.length).toBeGreaterThan(0);
  });

  it('shows bio preview toggle', () => {
    renderWithProviders();

    expect(screen.getByRole('button', { name: /Preview/i })).toBeInTheDocument();
  });

  it('displays markdown help text', () => {
    renderWithProviders();

    expect(screen.getByText(/Markdown formatting supported/i)).toBeInTheDocument();
  });
});
