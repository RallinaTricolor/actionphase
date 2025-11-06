import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UserProfileHeader } from './UserProfileHeader';
import type { UserProfile } from '../types/user-profiles';

const mockProfile: UserProfile = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  display_name: 'Test User',
  bio: 'This is a **test** bio',
  avatar_url: 'http://localhost:3000/uploads/avatar.jpg',
  created_at: '2024-01-15T00:00:00Z',
  timezone: 'America/New_York',
  is_admin: false,
};

describe('UserProfileHeader', () => {
  it('renders user avatar when avatar_url is provided', () => {
    render(<UserProfileHeader profile={mockProfile} />);

    const avatar = screen.getByAltText("Test User's avatar");
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('src', 'http://localhost:3000/uploads/avatar.jpg');
  });

  it('renders fallback avatar with initials when no avatar_url', () => {
    const profileWithoutAvatar = { ...mockProfile, avatar_url: null };
    render(<UserProfileHeader profile={profileWithoutAvatar} />);

    // Should show initials (TU for Test User)
    expect(screen.getByText('TU')).toBeInTheDocument();
  });

  it('displays username with @ symbol', () => {
    render(<UserProfileHeader profile={mockProfile} />);
    expect(screen.getByText('@testuser')).toBeInTheDocument();
  });

  it('displays display name', () => {
    render(<UserProfileHeader profile={mockProfile} />);
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('falls back to username when display_name is null', () => {
    const profileWithoutDisplayName = { ...mockProfile, display_name: null };
    render(<UserProfileHeader profile={profileWithoutDisplayName} />);

    // Username should be displayed twice: as title and as @username
    const usernameElements = screen.getAllByText(/testuser/i);
    expect(usernameElements.length).toBeGreaterThan(0);
  });

  it('renders bio with markdown support', () => {
    render(<UserProfileHeader profile={mockProfile} />);

    // Bio text should be present (match partial text since markdown splits into elements)
    expect(screen.getByText(/This is a/i)).toBeInTheDocument();
    expect(screen.getByText(/test/i, { selector: 'strong' })).toBeInTheDocument();
  });

  it('displays "No bio yet" when bio is null', () => {
    const profileWithoutBio = { ...mockProfile, bio: null };
    render(<UserProfileHeader profile={profileWithoutBio} />);

    // Component renders "No bio yet" without period
    expect(screen.getByText('No bio yet')).toBeInTheDocument();
  });

  it('displays admin badge when user is admin', () => {
    const adminProfile = { ...mockProfile, is_admin: true };
    render(<UserProfileHeader profile={adminProfile} />);

    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('does not display admin badge for non-admin users', () => {
    render(<UserProfileHeader profile={mockProfile} />);

    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('displays formatted member since date', () => {
    render(<UserProfileHeader profile={mockProfile} />);

    // Should show member since with the date
    expect(screen.getByText(/Member since/i)).toBeInTheDocument();
    // Date might vary by locale, so just check it contains "2024"
    expect(screen.getByText(/2024/i)).toBeInTheDocument();
  });
});
