/**
 * Small text helpers the board's checks share: name lists, whole-word
 * matching, and markdown reduced to plain text. Plain word rules, no AI.
 */

export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Whether `term` appears in `text` as a whole word or phrase. A single word
 * matches case-sensitively, so a name like "Rose" doesn't match "rose"; a
 * phrase matches in any case.
 */
export function termIn(text: string, term: string): boolean {
  const t = term.trim();
  if (!t) return false;
  const single = !/\s/.test(t);
  return new RegExp(`(^|[^\\w])${escapeRegExp(t)}(?=$|[^\\w])`, single ? '' : 'i').test(text);
}

/** Markdown reduced to its words: `[[name|…]]` and `[text](url)` links keep their text, emphasis marks go. */
export function plainText(markdown: string): string {
  return String(markdown || '')
    .replace(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '$1')
    .replace(/\*\*|__|~~/g, '');
}

/** Plain text on one line, cut to `max` characters with an ellipsis. */
export function truncate(text: string, max: number): string {
  const t = plainText(text).replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** A character's names when the GM hasn't set any: the full name, plus the first word if it's 3+ letters. */
export function defaultNames(fullName: string): string[] {
  const name = fullName.trim();
  const first = name.split(/\s+/)[0] ?? '';
  return first.length >= 3 && first !== name ? [name, first] : [name];
}

/**
 * The names the board matches a character by. A list the GM set wins, even an
 * empty one (the GM turned matching off for that character).
 */
export function characterNames(names: Record<number, string[]>, characterId: number, fullName: string): string[] {
  return Object.prototype.hasOwnProperty.call(names, characterId) ? names[characterId] : defaultNames(fullName);
}
