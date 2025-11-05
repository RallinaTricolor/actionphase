import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, render, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeadlineList } from './DeadlineList';
import type { Deadline } from '../types/deadlines';

describe('DeadlineList', () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();

  const sampleDeadlines: Deadline[] = [
    {
      id: 1,
      game_id: 1,
      title: 'Phase 1 Deadline',
      description: 'Submit your action for Phase 1',
      deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours from now
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 2,
      game_id: 1,
      title: 'Character Creation Deadline',
      description: 'Complete your character sheet',
      deadline: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), // 12 hours from now
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading state', () => {
    it('should display loading message when isLoading is true', () => {
      render(<DeadlineList deadlines={[]} isLoading={true} />);

      expect(screen.getByText('Loading deadlines...')).toBeInTheDocument();
    });

    it('should not display deadlines during loading', () => {
      render(<DeadlineList deadlines={sampleDeadlines} isLoading={true} />);

      expect(screen.queryByText('Phase 1 Deadline')).not.toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('should display default empty message when no deadlines', () => {
      render(<DeadlineList deadlines={[]} isLoading={false} />);

      expect(screen.getByText('No deadlines yet.')).toBeInTheDocument();
    });

    it('should display custom empty message when provided', () => {
      const customMessage = 'No deadlines for this game.';

      render(
        <DeadlineList
          deadlines={[]}
          isLoading={false}
          emptyMessage={customMessage}
        />
      );

      expect(screen.getByText(customMessage)).toBeInTheDocument();
    });
  });

  describe('Deadline rendering', () => {
    it('should render all deadlines', () => {
      render(<DeadlineList deadlines={sampleDeadlines} isLoading={false} />);

      expect(screen.getByText('Phase 1 Deadline')).toBeInTheDocument();
      expect(screen.getByText('Character Creation Deadline')).toBeInTheDocument();
    });

    it('should display deadline titles', () => {
      render(<DeadlineList deadlines={sampleDeadlines} isLoading={false} />);

      const titles = screen.getAllByRole('heading', { level: 3 });
      expect(titles).toHaveLength(2);
      // Deadlines are sorted by soonest first (Character Creation = 12h, Phase 1 = 48h)
      expect(titles[0]).toHaveTextContent('Character Creation Deadline');
      expect(titles[1]).toHaveTextContent('Phase 1 Deadline');
    });

    it('should display deadline descriptions', () => {
      render(<DeadlineList deadlines={sampleDeadlines} isLoading={false} />);

      expect(screen.getByText('Submit your action for Phase 1')).toBeInTheDocument();
      expect(screen.getByText('Complete your character sheet')).toBeInTheDocument();
    });

    it('should display deadline timer for each deadline', () => {
      render(<DeadlineList deadlines={sampleDeadlines} isLoading={false} />);

      // Should have timer badges showing relative time
      const timers = screen.getAllByText(/in \d+ (hour|day)s?/i);
      expect(timers.length).toBeGreaterThan(0);
    });

    it('should display "Due:" label with formatted deadline', () => {
      render(<DeadlineList deadlines={sampleDeadlines} isLoading={false} />);

      const dueDates = screen.getAllByText(/^Due:/);
      expect(dueDates).toHaveLength(2);
    });

    it('should handle deadline without description', () => {
      const deadlineWithoutDescription: Deadline[] = [
        {
          ...sampleDeadlines[0],
          description: undefined,
        },
      ];

      render(<DeadlineList deadlines={deadlineWithoutDescription} isLoading={false} />);

      expect(screen.getByText('Phase 1 Deadline')).toBeInTheDocument();
      // Description should not be rendered
      expect(screen.queryByText('Submit your action for Phase 1')).not.toBeInTheDocument();
    });

    it('should handle deadline without deadline field', () => {
      const deadlineWithoutDate: Deadline[] = [
        {
          ...sampleDeadlines[0],
          deadline: undefined,
        },
      ];

      render(<DeadlineList deadlines={deadlineWithoutDate} isLoading={false} />);

      expect(screen.getByText('Phase 1 Deadline')).toBeInTheDocument();
      // Timer and due date should not be rendered
      expect(screen.queryByText(/Due:/)).not.toBeInTheDocument();
    });
  });

  describe('Action buttons', () => {
    it('should show edit and delete buttons when showActions is true', () => {
      render(
        <DeadlineList
          deadlines={sampleDeadlines}
          isLoading={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          showActions={true}
        />
      );

      const editButtons = screen.getAllByRole('button', { name: /edit deadline/i });
      const deleteButtons = screen.getAllByRole('button', { name: /delete deadline/i });

      expect(editButtons).toHaveLength(2);
      expect(deleteButtons).toHaveLength(2);
    });

    it('should not show action buttons when showActions is false', () => {
      render(
        <DeadlineList
          deadlines={sampleDeadlines}
          isLoading={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          showActions={false}
        />
      );

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('should not show action buttons when onEdit and onDelete are not provided', () => {
      render(
        <DeadlineList
          deadlines={sampleDeadlines}
          isLoading={false}
          showActions={true}
        />
      );

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('should call onEdit with correct deadline when edit is clicked', async () => {
      const user = userEvent.setup();

      render(
        <DeadlineList
          deadlines={sampleDeadlines}
          isLoading={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          showActions={true}
        />
      );

      const editButtons = screen.getAllByRole('button', { name: /edit deadline/i });
      await user.click(editButtons[0]);

      // First button is for Character Creation (12h, soonest), not Phase 1 (48h)
      expect(mockOnEdit).toHaveBeenCalledWith(sampleDeadlines[1]);
    });
  });

  describe('Delete functionality', () => {
    it('should show confirmation dialog when delete is clicked', async () => {
      const user = userEvent.setup();

      render(
        <DeadlineList
          deadlines={sampleDeadlines}
          isLoading={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          showActions={true}
        />
      );

      const deleteButtons = screen.getAllByRole('button', { name: /delete deadline/i });
      await user.click(deleteButtons[0]);

      // Component uses Modal instead of window.confirm
      // First button is for Character Creation (soonest deadline)
      expect(screen.getByText(/Are you sure you want to delete "Character Creation Deadline"/i)).toBeInTheDocument();
    });

    it('should call onDelete when deletion is confirmed', async () => {
      const user = userEvent.setup();

      render(
        <DeadlineList
          deadlines={sampleDeadlines}
          isLoading={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          showActions={true}
        />
      );

      const deleteButtons = screen.getAllByRole('button', { name: /delete deadline/i });
      await user.click(deleteButtons[0]);

      // Click the "Delete" button in the modal
      const confirmButton = screen.getByRole('button', { name: /^Delete$/i });
      await user.click(confirmButton);

      // First rendered deadline is Character Creation (id: 2)
      expect(mockOnDelete).toHaveBeenCalledWith(2);
    });

    it('should not call onDelete when deletion is cancelled', async () => {
      const user = userEvent.setup();

      render(
        <DeadlineList
          deadlines={sampleDeadlines}
          isLoading={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          showActions={true}
        />
      );

      const deleteButtons = screen.getAllByRole('button', { name: /delete deadline/i });
      await user.click(deleteButtons[0]);

      // Click the "Cancel" button in the modal
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(mockOnDelete).not.toHaveBeenCalled();
    });

    it('should disable delete button for deadline being deleted', async () => {
      const user = userEvent.setup();

      const { rerender } = render(
        <DeadlineList
          deadlines={sampleDeadlines}
          isLoading={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          showActions={true}
        />
      );

      const deleteButtons = screen.getAllByRole('button', { name: /delete deadline/i });
      await user.click(deleteButtons[0]);

      // Click confirm to trigger deletion
      const confirmButton = screen.getByRole('button', { name: /^Delete$/i });
      await user.click(confirmButton);

      // After confirming delete, the button should be disabled
      // (the component sets deletingId = deadline.id)
      expect(deleteButtons[0]).toBeDisabled();
    });

    it('should disable edit button for deadline being deleted', async () => {
      const user = userEvent.setup();

      render(
        <DeadlineList
          deadlines={sampleDeadlines}
          isLoading={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          showActions={true}
        />
      );

      const deleteButtons = screen.getAllByRole('button', { name: /delete deadline/i });
      const editButtons = screen.getAllByRole('button', { name: /edit deadline/i });

      await user.click(deleteButtons[0]);

      // Click confirm to trigger deletion
      const confirmButton = screen.getByRole('button', { name: /^Delete$/i });
      await user.click(confirmButton);

      // Edit button for the same deadline should also be disabled
      expect(editButtons[0]).toBeDisabled();
    });
  });

  describe('Multiple deadlines', () => {
    it('should render deadlines sorted by soonest first', () => {
      render(<DeadlineList deadlines={sampleDeadlines} isLoading={false} />);

      const titles = screen.getAllByRole('heading', { level: 3 });
      // Component sorts by soonest deadline first
      expect(titles[0]).toHaveTextContent('Character Creation Deadline');
      expect(titles[1]).toHaveTextContent('Phase 1 Deadline');
    });

    it('should handle single deadline', () => {
      const singleDeadline = [sampleDeadlines[0]];

      render(<DeadlineList deadlines={singleDeadline} isLoading={false} />);

      expect(screen.getByText('Phase 1 Deadline')).toBeInTheDocument();
      expect(screen.queryByText('Character Creation Deadline')).not.toBeInTheDocument();
    });

    it('should handle many deadlines', () => {
      const manyDeadlines: Deadline[] = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        game_id: 1,
        title: `Deadline ${i + 1}`,
        description: `Description ${i + 1}`,
        deadline: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toISOString(),
      }));

      render(<DeadlineList deadlines={manyDeadlines} isLoading={false} />);

      const titles = screen.getAllByRole('heading', { level: 3 });
      expect(titles).toHaveLength(10);
    });
  });

  describe('Styling and layout', () => {
    it('should render deadlines in cards', () => {
      render(<DeadlineList deadlines={sampleDeadlines} isLoading={false} />);

      // Should render all deadline titles
      expect(screen.getByText('Phase 1 Deadline')).toBeInTheDocument();
      expect(screen.getByText('Character Creation Deadline')).toBeInTheDocument();
    });

    it('should use Card component for each deadline', () => {
      render(<DeadlineList deadlines={sampleDeadlines} isLoading={false} />);

      // Each deadline should have a heading
      const headings = screen.getAllByRole('heading', { level: 3 });
      expect(headings).toHaveLength(2);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty array gracefully', () => {
      render(<DeadlineList deadlines={[]} isLoading={false} />);

      expect(screen.getByText('No deadlines yet.')).toBeInTheDocument();
    });

    it('should handle undefined callbacks gracefully', () => {
      render(
        <DeadlineList
          deadlines={sampleDeadlines}
          isLoading={false}
          showActions={true}
        />
      );

      // Should not crash, just not show action buttons
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should handle deadline with very long title', () => {
      const longTitleDeadline: Deadline[] = [
        {
          id: 1,
          game_id: 1,
          title: 'A'.repeat(200),
          description: 'Test',
          deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        },
      ];

      render(<DeadlineList deadlines={longTitleDeadline} isLoading={false} />);

      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('A'.repeat(200));
    });

    it('should handle deadline with very long description', () => {
      const longDescriptionDeadline: Deadline[] = [
        {
          id: 1,
          game_id: 1,
          title: 'Test',
          description: 'B'.repeat(1000),
          deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        },
      ];

      render(<DeadlineList deadlines={longDescriptionDeadline} isLoading={false} />);

      expect(screen.getByText('B'.repeat(1000))).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      render(<DeadlineList deadlines={sampleDeadlines} isLoading={false} />);

      const headings = screen.getAllByRole('heading', { level: 3 });
      expect(headings).toHaveLength(2);
    });

    it('should have descriptive button labels', () => {
      render(
        <DeadlineList
          deadlines={sampleDeadlines}
          isLoading={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          showActions={true}
        />
      );

      const editButtons = screen.getAllByRole('button', { name: /edit deadline/i });
      const deleteButtons = screen.getAllByRole('button', { name: /delete deadline/i });

      expect(editButtons).toHaveLength(2);
      expect(deleteButtons).toHaveLength(2);

      editButtons.forEach(button => {
        expect(button).toHaveAttribute('aria-label', 'Edit deadline');
      });

      deleteButtons.forEach(button => {
        expect(button).toHaveAttribute('aria-label', 'Delete deadline');
      });
    });

    it('should preserve whitespace in descriptions', () => {
      const multiLineDescription: Deadline[] = [
        {
          id: 1,
          game_id: 1,
          title: 'Test',
          description: 'Line 1\nLine 2\n\nLine 3',
          deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        },
      ];

      render(<DeadlineList deadlines={multiLineDescription} isLoading={false} />);

      // Description should be rendered
      const description = screen.getByText(/Line 1/);
      expect(description).toBeInTheDocument();
      // Check that it has the whitespace-pre-wrap class
      expect(description.className).toContain('whitespace-pre-wrap');
    });
  });
});
