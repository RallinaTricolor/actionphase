import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { UserProfileHeader } from '../components/UserProfileHeader';
import { UserGameHistory } from '../components/UserGameHistory';
import { Spinner, Button } from '../components/ui';

/**
 * UserProfilePage - Displays a user's public profile with game history
 *
 * Features:
 * - Avatar, display name, bio
 * - Game history with privacy filtering (anonymous games hide character details)
 * - Pagination for game history
 * - Responsive layout
 *
 * Route: /users/:username
 */
export function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['user-profile', username, page, pageSize],
    queryFn: () => apiClient.users.getUserProfile(username!, page, pageSize).then(res => res.data),
    enabled: !!username && username.trim().length > 0,
  });

  // Invalid username - still use consistent layout
  if (!username || username.trim().length === 0) {
    return (
      <div className="min-h-screen bg-surface-sunken py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-content-primary mb-4">
                Invalid username
              </h1>
              <p className="text-content-secondary">
                Please provide a valid username in the URL.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Consistent layout wrapper - no early returns
  return (
    <div className="min-h-screen bg-surface-sunken py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Loading state - maintains layout */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <Spinner size="lg" label="Loading profile..." />
          </div>
        )}

        {/* Error state - maintains layout */}
        {isError && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center max-w-md">
              <h1 className="text-2xl font-bold text-content-primary mb-4">
                Failed to load profile
              </h1>
              <p className="text-content-secondary mb-6">
                {error instanceof Error
                  ? error.message
                  : 'An unexpected error occurred while loading the user profile.'}
              </p>
              <Button variant="primary" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          </div>
        )}

        {/* Success state - show profile */}
        {!isLoading && !isError && data && (
          <>
            {/* Profile Header */}
            <UserProfileHeader profile={data.user} />

            {/* Game History */}
            <div className="mt-8">
              <UserGameHistory
                games={data.games}
                metadata={data.metadata}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                isLoading={isLoading}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
