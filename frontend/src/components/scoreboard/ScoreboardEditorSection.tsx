import { useId, type ReactNode } from 'react';
import { Card } from '@/components/ui';

interface ScoreboardEditorSectionProps {
  title: string;
  /** One line under the title saying what the section decides. */
  description?: string;
  children: ReactNode;
  'data-testid'?: string;
}

/**
 * One part of the scoreboard setup, as a titled card. The editor sets these on
 * a sunken backdrop, so each part reads as its own block.
 */
export function ScoreboardEditorSection({ title, description, children, 'data-testid': testId }: ScoreboardEditorSectionProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} data-testid={testId}>
      <Card variant="default" padding="none" className="shadow-sm">
        <div className="border-b border-theme-default px-3 py-3 sm:px-4">
          <h3 id={headingId} className="text-lg font-semibold text-content-primary">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-content-secondary">{description}</p>}
        </div>
        <div className="p-3 sm:p-4">{children}</div>
      </Card>
    </section>
  );
}
