import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CharacterAutocomplete, Character } from './CharacterAutocomplete';

describe('CharacterAutocomplete', () => {
  const mockCharacters: Character[] = [
    { id: 1, name: 'Aragorn', avatar_url: 'https://example.com/aragorn.jpg' },
    { id: 2, name: 'Gandalf', avatar_url: 'https://example.com/gandalf.jpg' },
    { id: 3, name: 'Arwen' }, // No avatar
    { id: 4, name: 'Legolas' },
  ];

  const defaultProps = {
    characters: mockCharacters,
    query: '',
    position: { top: 100, left: 50 },
    onSelect: vi.fn(),
    selectedIndex: 0,
    onClose: vi.fn(),
  };

  describe('Basic Rendering', () => {
    it('renders listbox with all characters when query is empty', () => {
      render(<CharacterAutocomplete {...defaultProps} />);

      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(screen.getByText('Aragorn')).toBeInTheDocument();
      expect(screen.getByText('Gandalf')).toBeInTheDocument();
      expect(screen.getByText('Arwen')).toBeInTheDocument();
      expect(screen.getByText('Legolas')).toBeInTheDocument();
    });

    it('renders at specified position', () => {
      const { container } = render(<CharacterAutocomplete {...defaultProps} />);
      const listbox = container.querySelector('[role="listbox"]');

      expect(listbox).toHaveStyle({ top: '100px', left: '50px' });
    });

    it('renders character avatars when available', () => {
      render(<CharacterAutocomplete {...defaultProps} />);

      const aragornAvatar = screen.getByAltText('Aragorn');
      expect(aragornAvatar).toBeInTheDocument();
      expect(aragornAvatar).toHaveAttribute('src', 'https://example.com/aragorn.jpg');

      const gandalfAvatar = screen.getByAltText('Gandalf');
      expect(gandalfAvatar).toBeInTheDocument();
    });

    it('renders without avatars for characters without avatar_url', () => {
      render(<CharacterAutocomplete {...defaultProps} />);

      expect(screen.queryByAltText('Arwen')).not.toBeInTheDocument();
      expect(screen.getByText('Arwen')).toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('filters characters by query (case insensitive)', () => {
      render(<CharacterAutocomplete {...defaultProps} query="ara" />);

      expect(screen.getByText('Aragorn')).toBeInTheDocument();
      expect(screen.queryByText('Gandalf')).not.toBeInTheDocument();
      expect(screen.queryByText('Legolas')).not.toBeInTheDocument();
    });

    it('filters with uppercase query', () => {
      render(<CharacterAutocomplete {...defaultProps} query="ARA" />);

      expect(screen.getByText('Aragorn')).toBeInTheDocument();
      expect(screen.queryByText('Gandalf')).not.toBeInTheDocument();
    });

    it('filters with partial match anywhere in name', () => {
      render(<CharacterAutocomplete {...defaultProps} query="wen" />);

      expect(screen.getByText('Arwen')).toBeInTheDocument();
      expect(screen.queryByText('Aragorn')).not.toBeInTheDocument();
    });

    it('shows "no results" message when no characters match', () => {
      render(<CharacterAutocomplete {...defaultProps} query="xyz" />);

      expect(screen.getByText('No characters found')).toBeInTheDocument();
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('shows all characters when query is empty string', () => {
      render(<CharacterAutocomplete {...defaultProps} query="" />);

      expect(screen.getByText('Aragorn')).toBeInTheDocument();
      expect(screen.getByText('Gandalf')).toBeInTheDocument();
      expect(screen.getByText('Arwen')).toBeInTheDocument();
      expect(screen.getByText('Legolas')).toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('highlights selected item', () => {
      const { rerender } = render(<CharacterAutocomplete {...defaultProps} selectedIndex={0} />);

      const aragornOption = screen.getByRole('option', { name: /Aragorn/i });
      expect(aragornOption).toHaveClass('bg-interactive-primary-subtle');
      expect(aragornOption).toHaveAttribute('aria-selected', 'true');

      rerender(<CharacterAutocomplete {...defaultProps} selectedIndex={1} />);

      const gandalfOption = screen.getByRole('option', { name: /Gandalf/i });
      expect(gandalfOption).toHaveClass('bg-interactive-primary-subtle');
      expect(gandalfOption).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onSelect when character is clicked', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<CharacterAutocomplete {...defaultProps} onSelect={onSelect} />);

      await user.click(screen.getByText('Gandalf'));

      expect(onSelect).toHaveBeenCalledWith(mockCharacters[1]);
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('calls onSelect with correct character', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<CharacterAutocomplete {...defaultProps} onSelect={onSelect} />);

      await user.click(screen.getByText('Arwen'));

      expect(onSelect).toHaveBeenCalledWith(mockCharacters[2]);
    });
  });

  describe('Accessibility', () => {
    it('has listbox role', () => {
      render(<CharacterAutocomplete {...defaultProps} />);
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('has option roles for each character', () => {
      render(<CharacterAutocomplete {...defaultProps} />);

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(4);
    });

    it('sets aria-selected on selected option', () => {
      render(<CharacterAutocomplete {...defaultProps} selectedIndex={1} />);

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveAttribute('aria-selected', 'false');
      expect(options[1]).toHaveAttribute('aria-selected', 'true');
      expect(options[2]).toHaveAttribute('aria-selected', 'false');
      expect(options[3]).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty characters array', () => {
      render(<CharacterAutocomplete {...defaultProps} characters={[]} />);

      expect(screen.getByText('No characters found')).toBeInTheDocument();
    });

    it('handles characters with special characters in names', () => {
      const specialChars: Character[] = [
        { id: 1, name: "O'Brien" },
        { id: 2, name: 'Jean-Luc' },
      ];

      render(<CharacterAutocomplete {...defaultProps} characters={specialChars} />);

      expect(screen.getByText("O'Brien")).toBeInTheDocument();
      expect(screen.getByText('Jean-Luc')).toBeInTheDocument();
    });

    it('handles very long character names', () => {
      const longName: Character[] = [
        { id: 1, name: 'A'.repeat(100) },
      ];

      render(<CharacterAutocomplete {...defaultProps} characters={longName} />);

      expect(screen.getByText('A'.repeat(100))).toBeInTheDocument();
    });

    it('scrolls selected item into view', () => {
      // This test verifies the useEffect that scrolls selected items
      // We just check that rendering with selectedIndex doesn't crash
      const manyCharacters = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        name: `Character ${i}`,
      }));

      const { rerender } = render(
        <CharacterAutocomplete {...defaultProps} characters={manyCharacters} selectedIndex={0} />
      );

      // Change selected index (should trigger scroll)
      rerender(
        <CharacterAutocomplete {...defaultProps} characters={manyCharacters} selectedIndex={10} />
      );

      expect(screen.getByText('Character 10')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('applies hover styles to non-selected options', () => {
      render(<CharacterAutocomplete {...defaultProps} selectedIndex={0} />);

      // Aragorn (index 0) is selected, so check Gandalf (index 1) for hover styles
      const gandalfOption = screen.getByRole('option', { name: /Gandalf/i });
      expect(gandalfOption).toHaveClass('hover:surface-raised');
      expect(gandalfOption).toHaveClass('cursor-pointer');
    });

    it('applies selected styles to highlighted option', () => {
      render(<CharacterAutocomplete {...defaultProps} selectedIndex={0} />);

      const aragornOption = screen.getByRole('option', { name: /Aragorn/i });
      expect(aragornOption).toHaveClass('bg-interactive-primary-subtle');
      expect(aragornOption).toHaveClass('text-interactive-primary');
    });

    it('renders with minimum width', () => {
      const { container } = render(<CharacterAutocomplete {...defaultProps} />);
      const listbox = container.querySelector('[role="listbox"]');

      expect(listbox).toHaveStyle({ minWidth: '200px' });
    });

    it('renders with scrollable container', () => {
      const { container } = render(<CharacterAutocomplete {...defaultProps} />);
      const listbox = container.querySelector('[role="listbox"]');

      expect(listbox).toHaveClass('overflow-y-auto');
      expect(listbox).toHaveClass('max-h-48');
    });
  });
});
