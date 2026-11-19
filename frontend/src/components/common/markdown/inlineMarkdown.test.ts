import { describe, expect, it } from 'vitest';
import { renderInlineMarkdown } from './inlineMarkdown';

describe('renderInlineMarkdown', () => {
  it('keeps plain text plain, with no paragraph around it', () => {
    expect(renderInlineMarkdown('Healthy')).toBe('Healthy');
  });

  it('renders bold, italic, strikethrough and code', () => {
    expect(renderInlineMarkdown('**Down** *soon* ~~gone~~ `x`'))
      .toBe('<strong>Down</strong> <em>soon</em> <del>gone</del> <code>x</code>');
  });

  it('colours text, with formatting inside the colour', () => {
    expect(renderInlineMarkdown('[color:red]**Bloodied**[/color]'))
      .toBe('<span data-color="red"><strong>Bloodied</strong></span>');
  });

  it('leaves an unknown colour, or an unclosed tag, as written', () => {
    expect(renderInlineMarkdown('[color:mauve]Odd[/color]')).toBe('[color:mauve]Odd[/color]');
    expect(renderInlineMarkdown('[color:red]Bloody[/color')).toBe('[color:red]Bloody[/color');
  });

  it('keeps a link’s text but not the link, and drops images', () => {
    expect(renderInlineMarkdown('[Down](https://example.com)')).toBe('Down');
    expect(renderInlineMarkdown('![x](https://example.com/a.png)Ok')).toBe('Ok');
  });

  it('never lets HTML through beyond the colour span', () => {
    const html = renderInlineMarkdown('<img src=x onerror=alert(1)><b onclick="x()">Hi</b><span class="fixed inset-0" data-color="red">!</span>');
    expect(html).toBe('Hi<span data-color="red">!</span>');
  });
});
