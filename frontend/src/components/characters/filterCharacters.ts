import type { Character } from '@/types/characters';

/**
 * Characters matching a mention query, in display order. Space-insensitive,
 * so "@TestPlayer1" matches "Test Player 1 Character" (the query itself can't
 * contain a space -- typing one closes the dropdown).
 *
 * Shared with CommentEditor's key handler: the index it highlights and
 * accepts must point into the same list CharacterAutocomplete renders.
 */
export function filterCharacters(characters: Character[], query: string): Character[] {
  const needle = query.toLowerCase().replace(/\s+/g, '');
  return characters.filter((char) => char.name.toLowerCase().replace(/\s+/g, '').includes(needle));
}
