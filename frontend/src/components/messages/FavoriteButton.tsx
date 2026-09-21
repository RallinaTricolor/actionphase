import { Button } from '@/components/ui';

interface FavoriteButtonProps {
  commentId: number;
  isFavorited: boolean;
  onToggle: (commentId: number, currentlyFavorited: boolean) => void;
}

/**
 * The private star control, shared by every surface that shows a comment.
 *
 * One component rather than three copies so the icon, label and hit target
 * stay identical between the common room, the New Comments feed and the
 * character profile -- the star is the only control that appears on all of
 * them, and a star that looks different in one place reads as a different
 * feature.
 *
 * Deliberately presentational: it takes `isFavorited` and reports intent
 * through `onToggle` rather than calling the mutation itself, so each surface
 * can source star state from whichever id-set hook it already has (per-game or
 * cross-game) without this component knowing which.
 */
export function FavoriteButton({ commentId, isFavorited, onToggle }: FavoriteButtonProps) {
  const label = isFavorited ? 'Remove from favorites' : 'Favorite this comment';

  return (
    <Button
      variant="ghost"
      onClick={() => onToggle(commentId, isFavorited)}
      className="p-2 md:p-0 min-h-[44px] md:min-h-0 h-auto text-xs"
      title={label}
      aria-label={label}
      // It is a toggle, so it announces its state. The sibling read button
      // omits this; that is a gap, not a pattern to copy.
      aria-pressed={isFavorited}
      data-testid="favorite-button"
      data-faro-user-action-name="toggle-favorite"
    >
      <svg
        className={`w-4 h-4 ${isFavorited ? 'text-semantic-warning' : ''}`}
        fill={isFavorited ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      </svg>
      <span className={`hidden md:inline ${isFavorited ? 'text-semantic-warning' : ''}`}>
        {isFavorited ? 'Favorited' : 'Favorite'}
      </span>
    </Button>
  );
}
