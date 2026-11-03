import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { makeActionResult } from '@/test-utils/factories';
import { StagedPartStatus } from './StagedPartStatus';

const part = (n: number, extra = {}) => makeActionResult({ id: n, part_number: n, part_count: 2, ...extra });

describe('StagedPartStatus', () => {
  it('says nothing for an unstaged result', () => {
    const { container } = render(<StagedPartStatus result={makeActionResult()} onDelayChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('in a draft chain, part 1 goes out on publish and later parts wait for the one before', () => {
    render(
      <>
        <StagedPartStatus result={part(1)} onDelayChange={vi.fn()} />
        <StagedPartStatus result={part(2, { parent_result_id: 1, reveal_delay_minutes: 15 })} onDelayChange={vi.fn()} />
      </>,
    );
    expect(screen.getByTestId('staged-status-1')).toHaveTextContent('Part 1 of 2Revealed when published');
    expect(screen.getByTestId('staged-status-2')).toHaveTextContent('Part 2 of 2Reveals after the previous part');
    expect(screen.getByTestId('edit-staged-delay-2')).toHaveValue('15');
    expect(screen.queryByTestId('edit-staged-delay-1')).not.toBeInTheDocument();
  });

  it('shows when a part was revealed or will be, and no delay picker once it’s out', () => {
    render(
      <>
        <StagedPartStatus result={part(1, { is_published: true, released_at: '2026-11-03T10:00:00Z' })} onDelayChange={vi.fn()} />
        <StagedPartStatus result={part(2, { is_published: true, unlocks_at: '2026-11-03T10:15:00Z', reveal_delay_minutes: 15 })} onDelayChange={vi.fn()} />
      </>,
    );
    expect(screen.getByTestId('staged-status-1')).toHaveTextContent('Revealed');
    expect(screen.getByTestId('staged-status-2')).toHaveTextContent('Reveals');
    expect(screen.getByTestId('edit-staged-delay-2')).toBeInTheDocument();
  });
});
