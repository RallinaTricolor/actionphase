import { Badge } from '@/components/ui';
import { CollapsibleMarkdown } from '@/components/common/markdown/CollapsibleMarkdown';
import { StagedPartStatus } from '@/components/actions/StagedPartStatus';
import type { ResultChain } from '@/lib/gmBoard/results';

interface ResultChainViewProps {
  chain: ResultChain;
  /** "Result 1", "Result 2": its place in the character's list. */
  label: string;
}

/**
 * One of a character's results, read-only: each part's schedule and text,
 * drafts included (the results endpoint shows them to everyone who can see
 * the board). No controls, and none of the GM-only sheet-update counts.
 */
export function ResultChainView({ chain, label }: ResultChainViewProps) {
  const { head } = chain;
  return (
    <div
      className={`space-y-2 rounded-lg border p-3 ${head.is_published ? 'border-semantic-success' : 'border-theme-default'}`}
      data-testid={`result-chain-${head.id}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold text-content-primary">{label}</h4>
        {head.is_published ? (
          <Badge variant="success" size="sm">
            Published
          </Badge>
        ) : (
          <Badge variant="warning" size="sm">
            Draft
          </Badge>
        )}
        {head.is_published && head.sent_at && <span className="text-xs text-content-tertiary">Sent {new Date(head.sent_at).toLocaleString()}</span>}
      </div>
      <ol className="space-y-2">
        {chain.parts.map((part) => (
          <li key={part.id} className="space-y-1" data-testid={`result-part-${part.id}`}>
            {chain.parts.length > 1 && <StagedPartStatus result={part} />}
            <div className="rounded border border-theme-default p-2">
              {part.content.trim() ? (
                <CollapsibleMarkdown content={part.content} mentionedCharacters={[]} fullWidth />
              ) : (
                <p className="text-sm text-content-tertiary">Nothing written yet.</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
