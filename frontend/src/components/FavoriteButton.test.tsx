import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FavoriteButton } from './FavoriteButton';

// Purely presentational -- no queries, no network -- so a bare render is
// enough; no MSW server or provider wrapper needed.
describe('FavoriteButton', () => {
  it('renders an outline star and the unfavorited label when not favorited', () => {
    render(<FavoriteButton commentId={42} isFavorited={false} onToggle={vi.fn()} />);

    const button = screen.getByTestId('favorite-button');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAttribute('aria-label', 'Favorite this comment');
    expect(button).toHaveAttribute('title', 'Favorite this comment');

    // Outline, not filled: the fill attribute is what distinguishes the two
    // states visually, so it is worth asserting rather than trusting the class.
    const star = button.querySelector('svg');
    expect(star).toHaveAttribute('fill', 'none');
    expect(star?.getAttribute('class')).not.toContain('text-semantic-warning');
  });

  it('renders a filled amber star and the favorited label when favorited', () => {
    render(<FavoriteButton commentId={42} isFavorited={true} onToggle={vi.fn()} />);

    const button = screen.getByTestId('favorite-button');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAttribute('aria-label', 'Remove from favorites');
    expect(button).toHaveAttribute('title', 'Remove from favorites');

    const star = button.querySelector('svg');
    expect(star).toHaveAttribute('fill', 'currentColor');
    expect(star?.getAttribute('class')).toContain('text-semantic-warning');
  });

  it('reports the comment id and the CURRENT state when clicked', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();

    render(<FavoriteButton commentId={7} isFavorited={false} onToggle={onToggle} />);
    await user.click(screen.getByTestId('favorite-button'));

    // Passes the state it is in, not the state to move to -- the caller flips it.
    expect(onToggle).toHaveBeenCalledWith(7, false);
  });

  it('passes the favorited state through on click so the caller can unfavorite', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();

    render(<FavoriteButton commentId={7} isFavorited={true} onToggle={onToggle} />);
    await user.click(screen.getByTestId('favorite-button'));

    expect(onToggle).toHaveBeenCalledWith(7, true);
  });

  it('carries the faro user-action name for INP attribution', () => {
    render(<FavoriteButton commentId={1} isFavorited={false} onToggle={vi.fn()} />);

    expect(screen.getByTestId('favorite-button')).toHaveAttribute(
      'data-faro-user-action-name',
      'toggle-favorite'
    );
  });

  it('collapses its label on mobile, matching the sibling action-bar buttons', () => {
    render(<FavoriteButton commentId={1} isFavorited={false} onToggle={vi.fn()} />);

    // The bar's established idiom: icon always, label only from md up.
    const label = screen.getByText('Favorite');
    expect(label.className).toContain('hidden');
    expect(label.className).toContain('md:inline');
  });
});
