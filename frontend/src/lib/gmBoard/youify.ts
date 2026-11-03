/**
 * "Make it 'you'": rewrites text about one reader into second person. It swaps
 * the reader's names for "you" ("X's" for "your"), fixes the verb right after
 * a subject ("Mara enters" → "You enter"), and marks he/she words for the GM
 * to check. Plain word rules, no AI; it marks every change so the GM can see
 * what moved.
 */

import { escapeRegExp } from './text';

type YouMarkKind = 'you' | 'verb' | 'check';

/** A span of the output: `[start, end)` and why it's marked. */
interface YouMark {
  start: number;
  end: number;
  kind: YouMarkKind;
}

export interface YouifyResult {
  text: string;
  marks: YouMark[];
  /** How many names were swapped. */
  swapped: number;
}

const YOU_BE: Record<string, string> = {
  is: 'are', was: 'were', has: 'have', does: 'do',
  "isn't": "aren't", "wasn't": "weren't", "hasn't": "haven't", "doesn't": "don't",
  'isn’t': 'aren’t', 'wasn’t': 'weren’t', 'hasn’t': 'haven’t', 'doesn’t': 'don’t',
};

/** Words ending in s that aren't third-person verbs. */
const NOT_VERB = new Set([
  'as', 'us', 'thus', 'plus', 'his', 'its', 'this', 'always', 'perhaps', 'towards', 'afterwards',
  'sometimes', 'besides', 'unless', 'less', 'yes', 'whereas', 'was',
]);

/** The "you" form of a third-person verb ("enters" → "enter"), or null if the word isn't one. */
export function verbFor(word: string): string | null {
  const lw = word.toLowerCase();
  if (YOU_BE[lw]) return YOU_BE[lw];
  if (!/^[a-z]+$/.test(word) || NOT_VERB.has(lw) || word.length < 3 || /ss$/.test(lw) || !/s$/.test(lw)) return null;
  if (word.length > 4 && /[^aeiou]ies$/.test(lw)) return `${word.slice(0, -3)}y`;
  // "buzzes" → "buzz", but "freezes" → "freeze": after a single z the e is the verb's own.
  if (/(?:sh|ch|x|zz|ss|o)es$/.test(lw)) return word.slice(0, -2);
  return word.slice(0, -1);
}

/** A conjunction right before a name means the name is a subject: "…and Mara opens". */
const SUBJ_BEFORE = /(?:^|[\s(])(?:and|then|while|when|as|but|because|until|after|before|so|that|if|where|once|or|since|though|although)\s+$/i;

/** An optional adverb, then the word after a subject. */
const NEXT_WORD = /^(\s+)((?:[A-Za-z]+ly|then|also|still|never|always|just|only|soon|now|even|already|almost|finally|again|once)\s+)?([A-Za-z’']+)/;

/**
 * Rewrites `text` for the reader with these `names`. Names shorter than two
 * characters are ignored; longer names match first. With no names, the text
 * comes back unchanged.
 */
export function youify(text: string, names: string[]): YouifyResult {
  const src = String(text || '');
  const list = names.map((n) => String(n).trim()).filter((n) => n.length >= 2).sort((a, b) => b.length - a.length);
  if (!src || !list.length) return { text: src, marks: [], swapped: 0 };

  const re = new RegExp(`(?<![\\w'’])(?:${list.map(escapeRegExp).join('|')})(?:(['’])s(?![\\w]))?(?![\\w])`, 'g');
  let out = '';
  let last = 0;
  let swapped = 0;
  const marks: YouMark[] = [];
  const push = (s: string, kind?: YouMarkKind) => {
    if (kind) marks.push({ start: out.length, end: out.length + s.length, kind });
    out += s;
  };

  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const before = src.slice(0, m.index);
    const trimmed = before.replace(/[\s*_"“”‘'([>#-]+$/, '');
    const atStart = !trimmed || /[.!?…]$/.test(trimmed) || /\n[\s*_"“([>#-]*$/.test(before);
    push(src.slice(last, m.index));
    swapped++;
    last = re.lastIndex;
    if (m[1]) {
      push(atStart ? 'Your' : 'your', 'you');
      continue;
    }
    push(atStart ? 'You' : 'you', 'you');
    // Only a subject takes a verb: at a sentence start, after a conjunction, or after a comma or dash.
    if (!(atStart || SUBJ_BEFORE.test(before) || /[,;—–]\s*$/.test(before))) continue;
    const next = src.slice(last).match(NEXT_WORD);
    const verb = next && verbFor(next[3]);
    if (next && verb && verb !== next[3]) {
      push(next[1] + (next[2] || ''));
      push(verb, 'verb');
      last += next[0].length;
      re.lastIndex = last;
    }
  }
  push(src.slice(last));

  if (swapped) {
    for (const p of out.matchAll(/\b(?:he|him|his|himself|she|her|hers|herself)\b/gi)) {
      const start = p.index ?? 0;
      const end = start + p[0].length;
      if (!marks.some((k) => start < k.end && end > k.start)) marks.push({ start, end, kind: 'check' });
    }
  }
  marks.sort((a, b) => a.start - b.start);
  return { text: out, marks, swapped };
}

/**
 * Make "you" on a draft: `youify`, except inside any of `keep` (the reader's
 * own versions, which the GM already wrote for them and are never changed).
 */
export function youifyExcept(text: string, names: string[], keep: string[]): string {
  const spans = keep.map((k) => k.trim()).filter(Boolean);
  if (!spans.length) return youify(text, names).text;
  const re = new RegExp(spans.sort((a, b) => b.length - a.length).map(escapeRegExp).join('|'), 'g');
  let out = '';
  let last = 0;
  for (const m of text.matchAll(re)) {
    out += youify(text.slice(last, m.index), names).text + m[0];
    last = (m.index ?? 0) + m[0].length;
  }
  return out + youify(text.slice(last), names).text;
}
