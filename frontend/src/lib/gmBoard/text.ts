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

const ARTICLES = new Set(['the', 'a', 'an']);
const TITLES = new Set([
  'sir', 'dame', 'lady', 'lord', 'master', 'mistress', 'mr', 'mrs', 'ms', 'miss', 'dr', 'captain',
  'father', 'mother', 'brother', 'sister', 'king', 'queen', 'prince', 'princess', 'saint',
  'inspector', 'detective', 'sergeant', 'constable', 'officer', 'agent', 'chief', 'commander', 'colonel',
  'lieutenant', 'general', 'admiral', 'professor', 'prof', 'doctor', 'baron', 'baroness', 'duke', 'duchess',
  'countess', 'madam', 'madame', 'mister', 'elder', 'uncle', 'aunt',
]);

/**
 * The word a character goes by for short: the first word, or the one after a
 * title ("Sir Aldric" → "Aldric"). None after an article: "The Dark Lord"
 * isn't "The", which would match every sentence that starts with it.
 */
function givenName(fullName: string): string | null {
  const words = fullName.trim().split(/\s+/);
  const first = (words[0] ?? '').toLowerCase().replace(/\.$/, '');
  if (ARTICLES.has(first)) return null;
  if (TITLES.has(first)) return words[1] ?? null;
  return words[0] || null;
}

/** A character's names when the GM hasn't set any: the full name, plus the name they go by if it's 3+ letters. */
export function defaultNames(fullName: string): string[] {
  const name = fullName.trim();
  const given = givenName(name);
  return given && given.length >= 3 && given !== name ? [name, given] : [name];
}

/**
 * The names the board matches a character by. A list the GM set wins, even an
 * empty one (the GM turned matching off for that character).
 */
export function characterNames(names: Record<number, string[]>, characterId: number, fullName: string): string[] {
  return Object.prototype.hasOwnProperty.call(names, characterId) ? names[characterId] : defaultNames(fullName);
}

/**
 * The name the board shows where space is short: the name they go by
 * ("Shade (Whisper)" → "Shade", "Sir Aldric" → "Aldric"). A name with none
 * ("The Dark Lord"), or a stand-in for a character with no record
 * ("Character 12"), stays whole.
 */
export const shortName = (name: string) => (/^Character \d+$/.test(name.trim()) ? name.trim() : (givenName(name) ?? name.trim()));

/** A comma-separated list as typed into a field: trimmed, blanks dropped. */
export const splitList = (text: string) =>
  text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
