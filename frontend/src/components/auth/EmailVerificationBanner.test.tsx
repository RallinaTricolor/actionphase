import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test-utils/render';
import { EmailVerificationBanner } from './EmailVerificationBanner';

vi.mock('@/lib/api', () => ({
  apiClient: {
    auth: {
      resendVerificationEmail: vi.fn(),
    },
  },
}));

import { apiClient } from '@/lib/api';
import { makeAxiosResponse } from '@/test-utils/factories';

describe('EmailVerificationBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the banner with verification message', () => {
    renderWithProviders(<EmailVerificationBanner />);
    expect(screen.getByText(/email not verified/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resend email/i })).toBeInTheDocument();
  });

  it('disappears after clicking dismiss', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<EmailVerificationBanner />);

    const dismissButton = screen.getByRole('button', { name: /dismiss/i });
    await user.click(dismissButton);

    expect(screen.queryByText(/email not verified/i)).not.toBeInTheDocument();
  });

  it('calls resendVerificationEmail when Resend Email is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    vi.mocked(apiClient.auth.resendVerificationEmail).mockResolvedValue(
      makeAxiosResponse({ message: 'Verification email sent' }),
    );

    renderWithProviders(<EmailVerificationBanner />);
    await user.click(screen.getByRole('button', { name: /resend email/i }));

    await waitFor(() => {
      expect(apiClient.auth.resendVerificationEmail).toHaveBeenCalledOnce();
    });
  });
});
