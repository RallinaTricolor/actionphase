import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewSourceModal } from './ViewSourceModal';
import { copyToClipboard } from '@/utils/clipboard';

vi.mock('@/utils/clipboard', () => ({
  copyToClipboard: vi.fn(),
}));

vi.mock('@/services/LoggingService', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// The whole point of the feature: markdown the renderer would turn into a
// table must come back character-for-character, not as rendered text.
const TABLE_MARKDOWN = [
  '| Name | HP |',
  '|------|---:|',
  '| **Ogre** | 42 |',
  '',
  '<!-- GM note -->',
].join('\n');

describe('ViewSourceModal', () => {
  beforeEach(() => {
    vi.mocked(copyToClipboard).mockReset();
  });

  it('shows the raw markdown verbatim in a read-only field', () => {
    render(<ViewSourceModal isOpen onClose={vi.fn()} content={TABLE_MARKDOWN} kind="post" />);

    const source = screen.getByTestId('markdown-source') as HTMLTextAreaElement;
    expect(source.value).toBe(TABLE_MARKDOWN);
    expect(source).toHaveAttribute('readonly');
    expect(screen.getByText('Post source')).toBeInTheDocument();
  });

  it('titles itself for comments', () => {
    render(<ViewSourceModal isOpen onClose={vi.fn()} content="hi" kind="comment" />);
    expect(screen.getByText('Comment source')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(<ViewSourceModal isOpen={false} onClose={vi.fn()} content={TABLE_MARKDOWN} kind="post" />);
    expect(screen.queryByTestId('markdown-source')).not.toBeInTheDocument();
  });

  it('copies the exact markdown and confirms it', async () => {
    const user = userEvent.setup();
    vi.mocked(copyToClipboard).mockResolvedValue(true);
    render(<ViewSourceModal isOpen onClose={vi.fn()} content={TABLE_MARKDOWN} kind="post" />);

    await user.click(screen.getByRole('button', { name: 'Copy markdown' }));

    expect(copyToClipboard).toHaveBeenCalledWith(TABLE_MARKDOWN);
    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument();
  });

  it('tells the user when the copy fails', async () => {
    const user = userEvent.setup();
    vi.mocked(copyToClipboard).mockRejectedValue(new Error('denied'));
    render(<ViewSourceModal isOpen onClose={vi.fn()} content={TABLE_MARKDOWN} kind="post" />);

    await user.click(screen.getByRole('button', { name: 'Copy markdown' }));

    expect(await screen.findByRole('button', { name: 'Copy failed' })).toBeInTheDocument();
  });

  it('calls onClose from the Close button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ViewSourceModal isOpen onClose={onClose} content="hi" kind="post" />);

    // By text: the Modal's own X button also carries aria-label="Close".
    await user.click(screen.getByText('Close'));

    expect(onClose).toHaveBeenCalled();
  });
});
