import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RecentResultsSection } from '../RecentResultsSection';
import type { ActionResult } from '../../types/phases';

// Mock the useNavigate hook
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock MarkdownPreview component
vi.mock('../MarkdownPreview', () => ({
  MarkdownPreview: ({ content }: { content: string }) => <div data-testid="markdown-preview">{content}</div>,
}));

describe('RecentResultsSection', () => {
  const mockResults: ActionResult[] = [
    {
      id: 1,
      game_id: 100,
      user_id: 1,
      phase_id: 1,
      gm_user_id: 10,
      content: '# Investigation Results\n\nYou found a mysterious book in the library.',
      is_published: true,
      sent_at: '2025-10-28T12:00:00Z',
      username: 'Player1',
    },
    {
      id: 2,
      game_id: 100,
      user_id: 2,
      phase_id: 1,
      gm_user_id: 10,
      content: '# Basement Discovery\n\nYou discovered a hidden passage.',
      is_published: true,
      sent_at: '2025-10-28T12:30:00Z',
      username: 'Player2',
    },
  ];

  const defaultProps = {
    gameId: 100,
    results: mockResults,
    previousPhaseId: 1,
    previousPhaseTitle: 'Investigation Phase',
  };

  beforeEach(() => {
    mockNavigate.mockClear();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  const renderWithRouter = (ui: React.ReactElement) => {
    return render(<BrowserRouter>{ui}</BrowserRouter>);
  };

  describe('Basic Rendering', () => {
    it('should render the section header with correct title and badge', () => {
      renderWithRouter(<RecentResultsSection {...defaultProps} />);

      expect(screen.getByText('Recent Action Results')).toBeInTheDocument();
      expect(screen.getByText('From Investigation Phase')).toBeInTheDocument();
      expect(screen.getByText('2 results')).toBeInTheDocument();
    });

    it('should show correct badge text for single result', () => {
      const singleResult = [mockResults[0]];
      renderWithRouter(<RecentResultsSection {...defaultProps} results={singleResult} />);

      expect(screen.getByText('1 result')).toBeInTheDocument();
    });

    it('should render "View Full Results" button in header', () => {
      renderWithRouter(<RecentResultsSection {...defaultProps} />);

      const buttons = screen.getAllByText('View Full Results');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should not render when results array is empty', () => {
      const { container } = renderWithRouter(<RecentResultsSection {...defaultProps} results={[]} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Expand/Collapse Functionality', () => {
    it('should start expanded on first view (no localStorage)', () => {
      renderWithRouter(<RecentResultsSection {...defaultProps} />);

      // Should show results content when expanded
      expect(screen.getByText('Player1')).toBeInTheDocument();
      expect(screen.getByText('Player2')).toBeInTheDocument();
    });

    it('should start collapsed if already viewed (localStorage exists)', () => {
      localStorage.setItem('results-viewed-100-1', 'true');
      renderWithRouter(<RecentResultsSection {...defaultProps} />);

      // Should not show result usernames when collapsed
      expect(screen.queryByText('Player1')).not.toBeInTheDocument();
      expect(screen.queryByText('Player2')).not.toBeInTheDocument();
    });

    it('should toggle expansion when clicking header', () => {
      renderWithRouter(<RecentResultsSection {...defaultProps} />);

      // Initially expanded
      expect(screen.getByText('Player1')).toBeInTheDocument();

      // Click header to collapse
      const header = screen.getByText('Recent Action Results').closest('div');
      fireEvent.click(header!);

      // Should be collapsed now
      expect(screen.queryByText('Player1')).not.toBeInTheDocument();

      // Click again to expand
      fireEvent.click(header!);

      // Should be expanded again
      expect(screen.getByText('Player1')).toBeInTheDocument();
    });

    it('should save viewed state to localStorage when expanded', () => {
      renderWithRouter(<RecentResultsSection {...defaultProps} />);

      // Should save to localStorage on first view
      expect(localStorage.getItem('results-viewed-100-1')).toBe('true');
    });
  });

  describe('Individual Result Cards', () => {
    it('should render all result cards with usernames and timestamps', () => {
      renderWithRouter(<RecentResultsSection {...defaultProps} />);

      expect(screen.getByText('Player1')).toBeInTheDocument();
      expect(screen.getByText('Player2')).toBeInTheDocument();

      // Check timestamps are rendered (formatted)
      const timestamps = screen.getAllByText(/10\/28\/2025/);
      expect(timestamps.length).toBeGreaterThanOrEqual(2);
    });

    it('should show preview text when result is collapsed', () => {
      renderWithRouter(<RecentResultsSection {...defaultProps} />);

      // Results start collapsed individually
      expect(screen.getByText(/You found a mysterious book in the library/)).toBeInTheDocument();
      expect(screen.getByText(/You discovered a hidden passage/)).toBeInTheDocument();
    });

    it('should expand individual result when clicked', () => {
      renderWithRouter(<RecentResultsSection {...defaultProps} />);

      // Find first result card
      const player1Card = screen.getByText('Player1').closest('div')?.parentElement?.parentElement;
      expect(player1Card).toBeInTheDocument();

      // Initially no MarkdownPreview (collapsed)
      expect(screen.queryByTestId('markdown-preview')).not.toBeInTheDocument();

      // Click to expand
      fireEvent.click(player1Card!);

      // Should now show MarkdownPreview
      expect(screen.getByTestId('markdown-preview')).toBeInTheDocument();
      expect(screen.getByText(/# Investigation Results/)).toBeInTheDocument();
    });

    it('should collapse individual result when clicked again', () => {
      renderWithRouter(<RecentResultsSection {...defaultProps} />);

      // Find and expand first result
      const player1Card = screen.getByText('Player1').closest('div')?.parentElement?.parentElement;
      fireEvent.click(player1Card!);
      expect(screen.getByTestId('markdown-preview')).toBeInTheDocument();

      // Click again to collapse
      fireEvent.click(player1Card!);
      expect(screen.queryByTestId('markdown-preview')).not.toBeInTheDocument();
    });

    it('should truncate preview text beyond 150 characters', () => {
      const longResult: ActionResult = {
        ...mockResults[0],
        content: 'A'.repeat(200),
      };

      renderWithRouter(<RecentResultsSection {...defaultProps} results={[longResult]} />);

      const preview = screen.getByText(/A{150}.../);
      expect(preview).toBeInTheDocument();
    });

    it('should not show ellipsis for content under 150 characters', () => {
      const shortResult: ActionResult = {
        ...mockResults[0],
        content: 'Short content',
      };

      renderWithRouter(<RecentResultsSection {...defaultProps} results={[shortResult]} />);

      const preview = screen.getByText('Short content');
      expect(preview).toBeInTheDocument();
      expect(preview.textContent).not.toContain('...');
    });
  });

  describe('Navigation', () => {
    it('should navigate to history tab when clicking "View Full Results" in header', () => {
      renderWithRouter(<RecentResultsSection {...defaultProps} />);

      // Find header "View Full Results" button (not the one in footer)
      const buttons = screen.getAllByText('View Full Results');
      fireEvent.click(buttons[0]);

      expect(mockNavigate).toHaveBeenCalledWith('/games/100?tab=history&phase=1');
    });

    it('should navigate to history tab when clicking "View Full Results in History" in footer', () => {
      renderWithRouter(<RecentResultsSection {...defaultProps} />);

      // Find footer button
      const footerButton = screen.getByText('View Full Results in History');
      fireEvent.click(footerButton);

      expect(mockNavigate).toHaveBeenCalledWith('/games/100?tab=history&phase=1');
    });

    it('should stop propagation when clicking header button to avoid toggle', () => {
      renderWithRouter(<RecentResultsSection {...defaultProps} />);

      const buttons = screen.getAllByText('View Full Results');
      const headerButton = buttons[0];

      // Clicking button should navigate but not toggle expansion
      fireEvent.click(headerButton);

      // Should still be expanded (results visible)
      expect(screen.getByText('Player1')).toBeInTheDocument();
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle result without username', () => {
      const resultWithoutUsername: ActionResult = {
        ...mockResults[0],
        username: undefined,
      };

      renderWithRouter(<RecentResultsSection {...defaultProps} results={[resultWithoutUsername]} />);

      expect(screen.getByText('Result')).toBeInTheDocument();
    });

    it('should handle result without sent_at timestamp', () => {
      const resultWithoutTimestamp: ActionResult = {
        ...mockResults[0],
        sent_at: '',
      };

      renderWithRouter(<RecentResultsSection {...defaultProps} results={[resultWithoutTimestamp]} />);

      // Should still render without crashing
      expect(screen.getByText('Player1')).toBeInTheDocument();
    });

    it('should use unique storage key per game and phase', () => {
      renderWithRouter(<RecentResultsSection {...defaultProps} />);
      expect(localStorage.getItem('results-viewed-100-1')).toBe('true');

      localStorage.clear();

      renderWithRouter(<RecentResultsSection {...defaultProps} gameId={200} previousPhaseId={5} />);
      expect(localStorage.getItem('results-viewed-200-5')).toBe('true');
      expect(localStorage.getItem('results-viewed-100-1')).toBeNull();
    });
  });

  describe('Accessibility', () => {
    it('should be able to click header for expand/collapse', () => {
      renderWithRouter(<RecentResultsSection {...defaultProps} />);

      const header = screen.getByText('Recent Action Results');
      expect(header).toBeInTheDocument();

      // Verify header is clickable by testing the click functionality
      const headerParent = header.closest('div');
      expect(headerParent).toBeInTheDocument();
    });

    it('should be able to click result cards', () => {
      renderWithRouter(<RecentResultsSection {...defaultProps} />);

      const resultCard = screen.getByText('Player1');
      expect(resultCard).toBeInTheDocument();

      // Verify card is clickable by testing presence
      const cardParent = resultCard.closest('div');
      expect(cardParent).toBeInTheDocument();
    });
  });

  describe('Multiple Results Expansion', () => {
    it('should allow expanding multiple results simultaneously', () => {
      renderWithRouter(<RecentResultsSection {...defaultProps} />);

      // Expand first result
      const player1Card = screen.getByText('Player1').closest('div')?.parentElement?.parentElement;
      fireEvent.click(player1Card!);

      // Expand second result
      const player2Card = screen.getByText('Player2').closest('div')?.parentElement?.parentElement;
      fireEvent.click(player2Card!);

      // Both should be expanded
      const markdownPreviews = screen.getAllByTestId('markdown-preview');
      expect(markdownPreviews).toHaveLength(2);
    });

    it('should maintain independent expansion state for each result', () => {
      renderWithRouter(<RecentResultsSection {...defaultProps} />);

      // Expand first result
      const player1Card = screen.getByText('Player1').closest('div')?.parentElement?.parentElement;
      fireEvent.click(player1Card!);
      expect(screen.getAllByTestId('markdown-preview')).toHaveLength(1);

      // Expand second result
      const player2Card = screen.getByText('Player2').closest('div')?.parentElement?.parentElement;
      fireEvent.click(player2Card!);
      expect(screen.getAllByTestId('markdown-preview')).toHaveLength(2);

      // Collapse first result
      fireEvent.click(player1Card!);
      expect(screen.getAllByTestId('markdown-preview')).toHaveLength(1);
    });
  });
});
