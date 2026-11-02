import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { makeCard, makeCodexEntry } from '@/test-utils/factories';
import { SubmissionReader } from './SubmissionReader';

// jsdom has no CSS Custom Highlight API: stand in a registry that records
// which text each highlight covers.
let registry: Map<string, { ranges: Range[] }>;

beforeEach(() => {
  registry = new Map();
  vi.stubGlobal('CSS', { highlights: registry });
  vi.stubGlobal(
    'Highlight',
    class {
      ranges: Range[];
      constructor(...ranges: Range[]) {
        this.ranges = ranges;
      }
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

const painted = (name: string) => registry.get(name)?.ranges.map((r) => r.toString()) ?? [];

const TEXT = 'I meet Mara at the Old Mill.\n\nThen I hide the ledger in the vault.';
const props = {
  ownerId: 1,
  text: TEXT,
  characters: [
    { id: 1, names: ['Harrison'] },
    { id: 2, names: ['Mara'] },
  ],
  codex: [
    makeCodexEntry({ id: 'mill', type: 'Location', name: 'the Old Mill' }),
    makeCodexEntry({ id: 'ledger', type: 'Item', name: 'ledger' }),
    makeCodexEntry({ id: 'vault', type: 'Secret', name: 'vault' }),
  ],
  onAddCard: vi.fn(),
  onAddCodex: vi.fn(),
  onOpenCard: vi.fn(),
};

describe('SubmissionReader', () => {
  it('highlights carded text, names and codex terms by kind', () => {
    const cards = [makeCard({ id: 'c1', characterId: 1, quote: 'Then I hide the ledger' })];
    render(<SubmissionReader {...props} cards={cards} />);
    expect(painted('gm-carded')).toEqual(['Then I hide the ledger']);
    expect(painted('gm-name')).toEqual(['Mara']);
    expect(painted('gm-codex-location')).toEqual(['the Old Mill']);
    expect(painted('gm-codex')).toEqual(['ledger']);
    expect(painted('gm-codex-secret')).toEqual(['vault']);
  });

  it('doesn’t highlight the owner’s own name, or the board’s buttons', () => {
    const codex = [makeCodexEntry({ id: 'p', name: 'paragraph' })];
    render(
      <SubmissionReader {...props} codex={codex} text={'Harrison plans.'} cards={[makeCard({ id: 'c', characterId: 1, quote: 'Harrison plans.' })]} />,
    );
    expect(screen.getByRole('button', { name: '+ Whole paragraph' })).toBeInTheDocument();
    expect(painted('gm-codex')).toEqual([]);
    expect(painted('gm-name')).toEqual([]);
    expect(painted('gm-carded')).toEqual(['Harrison plans.']);
  });

  it('clears its highlights when it closes', () => {
    const { unmount } = render(<SubmissionReader {...props} cards={[makeCard({ id: 'c1', characterId: 1, quote: 'Then I hide' })]} />);
    expect(registry.has('gm-carded')).toBe(true);
    unmount();
    expect(registry.size).toBe(0);
  });

  it('opens the card under a click', () => {
    const onOpenCard = vi.fn();
    const cards = [makeCard({ id: 'c1', characterId: 1, quote: 'Then I hide the ledger' })];
    render(<SubmissionReader {...props} cards={cards} onOpenCard={onOpenCard} />);
    const node = screen.getByText(/Then I hide/).firstChild as Text;
    const caret = vi.fn(() => ({ offsetNode: node, offset: 5 }));
    Object.assign(document, { caretPositionFromPoint: caret });
    fireEvent.click(node.parentElement!);
    expect(onOpenCard).toHaveBeenCalledWith('c1');

    caret.mockReturnValue({ offsetNode: node, offset: node.data.indexOf('vault') });
    fireEvent.click(node.parentElement!);
    expect(onOpenCard).toHaveBeenCalledTimes(1);
    delete (document as { caretPositionFromPoint?: unknown }).caretPositionFromPoint;
  });

  it('shows how many cards came from each paragraph', () => {
    render(<SubmissionReader {...props} cards={[makeCard({ id: 'c1', characterId: 1, quote: 'x', src: [1] })]} />);
    expect(screen.getByTestId('submission-block-1')).toHaveTextContent(/^1/);
    expect(screen.getByTestId('submission-block-0')).not.toHaveTextContent(/^1/);
  });

  it('offers no carding to a viewer', () => {
    render(<SubmissionReader {...props} cards={[]} readOnly />);
    expect(screen.queryByRole('button', { name: '+ Whole paragraph' })).not.toBeInTheDocument();
  });

  it('says so when a submission is empty', () => {
    render(<SubmissionReader {...props} text="  " cards={[]} />);
    expect(screen.getByText('This submission is empty.')).toBeInTheDocument();
  });
});
