import { Link } from 'react-router-dom';
import { useOptionalGameContext } from '@/contexts/GameContext';

interface CharacterNameLinkProps {
  characterId: number | null | undefined;
  name: string;
  className?: string;
  'data-testid'?: string;
}

/**
 * A character's name, linked to its profile only when the viewer may open it.
 *
 * The entitlement check is a roster membership test, not a flag on the message.
 * GET /games/{id}/characters omits hidden NPCs from the response outright for a
 * caller who may not see them (backend/pkg/characters/huma_api.go), and
 * GameContext.allGameCharacters is that exact list. So "is this character in my
 * roster" is the same gate the backend already applied, evaluated client-side —
 * which is why no `is_hidden` field needs adding to the message payloads. That
 * would leak which characters are hidden to exactly the people it is kept from.
 *
 * Without this, a hidden NPC that posts in the common room renders an
 * underlined, hoverable name whose target 404s by design.
 *
 * Renders plain text rather than a link when:
 *   - the character is absent from the roster (hidden from this viewer), or
 *   - there is no id to link to, or
 *   - there is no GameProvider above it.
 *
 * The no-provider case is why this reads the OPTIONAL context: cross-game views
 * render message cards outside any one game, and there is no roster to check
 * against. Plain text is the safe answer — it never offers a link that 404s.
 * The roster loads asynchronously, so an empty list also yields plain text, and
 * names become links once it arrives.
 */
export function CharacterNameLink({
  characterId,
  name,
  className = '',
  'data-testid': dataTestId,
}: CharacterNameLinkProps) {
  const gameContext = useOptionalGameContext();
  const roster = gameContext?.allGameCharacters;

  const canOpenProfile =
    characterId !== null &&
    characterId !== undefined &&
    !!roster?.some((character) => character.id === characterId);

  if (!canOpenProfile) {
    return (
      <span className={className} data-testid={dataTestId}>
        {name}
      </span>
    );
  }

  return (
    <Link
      to={`/characters/${characterId}`}
      className={`${className} hover:underline`.trim()}
      data-testid={dataTestId}
    >
      {name}
    </Link>
  );
}
