import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import { applyColorMarkup } from './colorMarkup';

// Its own instance, so MarkdownPreview's block renderers (paragraph classes,
// code-block copy buttons) never apply here.
const inlineMarked = new Marked({ gfm: true });

// Only what fits inside a table cell: no links, images or blocks. A disallowed
// element keeps its text, so `[a](url)` reads as "a".
const INLINE_PURIFY_CONFIG: Parameters<typeof DOMPurify.sanitize>[1] = {
  ALLOWED_TAGS: ['strong', 'em', 'del', 'code', 'span'],
  ALLOWED_ATTR: ['data-color'],
  ALLOW_DATA_ATTR: false,
};

/**
 * A short label as sanitized HTML: bold, italic, strikethrough, inline code and
 * `[color:X]...[/color]`, on one line.
 */
export function renderInlineMarkdown(text: string): string {
  const html = inlineMarked.parseInline(applyColorMarkup(text), { async: false });
  return DOMPurify.sanitize(html, INLINE_PURIFY_CONFIG) as string;
}
