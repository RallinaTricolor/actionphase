import type { UserProfile } from '../types/user-profiles';
import { Card, CardBody, Badge } from './ui';
import { MarkdownPreview } from './MarkdownPreview';
import { getInitials, getAvatarColor } from '../utils/avatar';

interface UserProfileHeaderProps {
  profile: UserProfile;
}

/**
 * UserProfileHeader - Displays user avatar, name, bio, and member info
 *
 * Features:
 * - Large circular avatar (128px) with fallback
 * - Display name with username fallback
 * - Bio with markdown support
 * - Member since date
 * - Dark mode support via CSS variables
 */
export function UserProfileHeader({ profile }: UserProfileHeaderProps) {
  // Format member since date
  const memberSince = new Date(profile.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Determine display name (prefer display_name, fallback to username)
  const displayName = profile.display_name || profile.username;

  return (
    <Card variant="elevated" padding="md">
      <CardBody>
        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={`${displayName}'s avatar`}
                className="w-32 h-32 rounded-full object-cover ring-4 ring-border-primary"
              />
            ) : (
              <div
                className={`w-32 h-32 rounded-full flex items-center justify-center text-white font-semibold text-4xl ring-4 ring-border-primary ${getAvatarColor(
                  displayName
                )}`}
              >
                {getInitials(displayName)}
              </div>
            )}
          </div>

          {/* Profile Info */}
          <div className="flex-grow">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                {/* Display Name */}
                <h1 className="text-3xl font-bold text-content-heading">
                  {displayName}
                </h1>

                {/* Username */}
                <p className="text-lg text-content-secondary mt-1">
                  @{profile.username}
                </p>

                {/* Admin Badge */}
                {profile.is_admin && (
                  <Badge variant="primary" className="mt-2">
                    Admin
                  </Badge>
                )}
              </div>

              {/* Member Since */}
              <div className="text-sm text-content-secondary">
                <span className="block md:text-right">
                  Member since
                </span>
                <span className="block md:text-right font-medium text-content-primary">
                  {memberSince}
                </span>
              </div>
            </div>

            {/* Bio */}
            <div className="mt-6">
              <h2 className="text-lg font-semibold text-content-heading mb-2">
                About
              </h2>
              {profile.bio ? (
                <div className="prose prose-sm max-w-none text-content-primary">
                  <MarkdownPreview content={profile.bio} />
                </div>
              ) : (
                <p className="text-content-secondary italic">
                  No bio yet
                </p>
              )}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
