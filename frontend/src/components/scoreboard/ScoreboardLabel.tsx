import { useMemo } from 'react';
import { renderInlineMarkdown } from '@/components/common/markdown/inlineMarkdown';

interface ScoreboardLabelProps {
  /** A range label as the GM wrote it, formatting included. */
  text: string;
  className?: string;
}

/** A range label, with its bold, colours and the like. */
export function ScoreboardLabel({ text, className }: ScoreboardLabelProps) {
  const html = useMemo(() => renderInlineMarkdown(text), [text]);
  return <span className={className} data-testid="scoreboard-label" dangerouslySetInnerHTML={{ __html: html }} />;
}
