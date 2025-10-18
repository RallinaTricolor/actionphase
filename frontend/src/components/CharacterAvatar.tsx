import React, { useState } from 'react';

interface CharacterAvatarProps {
  avatarUrl?: string | null;
  characterName: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

/**
 * CharacterAvatar displays a character's avatar image with a fallback to initials
 *
 * Features:
 * - Displays avatar image if URL provided
 * - Falls back to colored circle with initials if no image or load error
 * - Supports multiple size variants (xs, sm, md, lg, xl)
 * - Consistent color per character name (deterministic hashing)
 *
 * @example
 * ```tsx
 * <CharacterAvatar
 *   avatarUrl="http://example.com/avatar.jpg"
 *   characterName="John Doe"
 *   size="md"
 * />
 * ```
 */
const CharacterAvatar: React.FC<CharacterAvatarProps> = ({
  avatarUrl,
  characterName,
  size = 'md',
  className = '',
}) => {
  const [imageLoadError, setImageLoadError] = useState(false);

  // Extract initials from character name
  const getInitials = (name: string): string => {
    if (!name || name.trim() === '') {
      return '?';
    }

    const words = name.trim().split(/\s+/);

    if (words.length === 1) {
      return words[0][0].toUpperCase();
    }

    // First and last word initials
    const firstInitial = words[0][0];
    const lastInitial = words[words.length - 1][0];

    return (firstInitial + lastInitial).toUpperCase();
  };

  // Generate consistent color based on character name
  const getColorClass = (name: string): string => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
    ];

    // Simple hash function for consistent color selection
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Size classes mapping
  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl',
  };

  const shouldShowImage = avatarUrl && !imageLoadError;

  return (
    <div
      data-testid="character-avatar"
      className={`${sizeClasses[size]} rounded-full overflow-hidden flex items-center justify-center ${className} ${
        !shouldShowImage ? `${getColorClass(characterName)} text-white font-semibold` : ''
      }`}
    >
      {shouldShowImage ? (
        <img
          src={avatarUrl}
          alt={characterName}
          className="w-full h-full object-cover"
          onError={() => setImageLoadError(true)}
        />
      ) : (
        <span>{getInitials(characterName)}</span>
      )}
    </div>
  );
};

export default CharacterAvatar;
