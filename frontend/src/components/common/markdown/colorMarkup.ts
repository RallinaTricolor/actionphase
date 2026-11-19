import { ALLOWED_COLORS } from './textColors';

/** Splits text into code (fenced or inline) and everything else, in order. */
export function splitByCodeBlocks(text: string): Array<{ text: string; isCode: boolean }> {
  const codeBlockRegex = /(```[\s\S]*?```|`[^`\n]+?`)/g;
  const segments: Array<{ text: string; isCode: boolean }> = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.substring(lastIndex, match.index), isCode: false });
    }
    segments.push({ text: match[0], isCode: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.substring(lastIndex), isCode: false });
  }

  if (segments.length === 0) {
    segments.push({ text, isCode: false });
  }

  return segments;
}

const COLOR_PATTERN = /\[color:([a-z]+)\]([\s\S]*?)\[\/color\]/g;

/**
 * Turns `[color:X]...[/color]` into `<span data-color="X">`, outside code. An
 * unknown colour stays as written. Run before markdown, whose sanitizer must
 * allow `span` and `data-color`.
 */
export function applyColorMarkup(text: string): string {
  if (!new RegExp(COLOR_PATTERN.source).test(text)) return text;

  return splitByCodeBlocks(text).map((segment) => {
    if (segment.isCode) return segment.text;
    return segment.text.replace(
      new RegExp(COLOR_PATTERN.source, 'g'),
      (match, colorName: string, innerText: string) =>
        ALLOWED_COLORS.has(colorName) ? `<span data-color="${colorName}">${innerText}</span>` : match,
    );
  }).join('');
}
