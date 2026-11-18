/** Putting text into a text box at the cursor, for inserts from outside the box. */

/**
 * `text` inserted into `value` between `start` and `end`, with a space either
 * side where it would otherwise run into a word. Returns the new value and
 * where the cursor goes (just after the insert).
 */
export function insertAt(value: string, start: number, end: number, text: string): { value: string; cursor: number } {
  const a = Math.max(0, Math.min(start, value.length));
  const b = Math.max(a, Math.min(end, value.length));
  const before = value.slice(0, a);
  const after = value.slice(b);
  const lead = before && !/\s$/.test(before) ? ' ' : '';
  const trail = after && !/^[\s.,;:!?)]/.test(after) ? ' ' : '';
  return { value: before + lead + text + trail + after, cursor: a + lead.length + text.length };
}
