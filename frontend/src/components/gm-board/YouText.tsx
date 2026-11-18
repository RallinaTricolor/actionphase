import type { ReactNode } from 'react';
import type { YouifyResult } from '@/lib/gmBoard/youify';

const TIPS = {
  you: 'Name swapped for “you”',
  verb: 'Verb changed to match “you”. Check it reads right.',
  check: 'Check: does this mean the reader?',
} as const;

/** A reader's text with what "Make it 'you'" changed marked. */
export function YouText({ result }: { result: YouifyResult }) {
  const parts: ReactNode[] = [];
  let at = 0;
  result.marks.forEach((m, i) => {
    if (m.start > at) parts.push(result.text.slice(at, m.start));
    parts.push(
      <mark key={i} className={`gm-you-${m.kind}`} title={TIPS[m.kind]}>
        {result.text.slice(m.start, m.end)}
      </mark>,
    );
    at = m.end;
  });
  parts.push(result.text.slice(at));
  return <span className="whitespace-pre-wrap">{parts}</span>;
}

