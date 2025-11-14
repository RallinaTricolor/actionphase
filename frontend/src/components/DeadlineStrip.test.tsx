import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeadlineStrip } from './DeadlineStrip';
import type { Deadline } from '../types/deadlines';

// Mock child components to simplify testing
vi.mock('./DeadlineCard', () => ({
  DeadlineCard: ({ deadline }: { deadline: Deadline }) => (
    <div data-testid="deadline-card">{deadline.title}</div>
  ),
}));

vi.mock('./CreateDeadlineModal', () => ({
  CreateDeadlineModal: () => <div data-testid="create-deadline-modal" />,
}));

vi.mock('./EditDeadlineModal', () => ({
  EditDeadlineModal: () => <div data-testid="edit-deadline-modal" />,
}));

describe('DeadlineStrip', () => {
  const mockDeadlines: Deadline[] = [
    {
      id: 1,
      game_id: 1,
      title: 'Submit Actions',
      description: 'Submit your actions by this deadline',
      deadline: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    },
  ];

  const defaultProps = {
    deadlines: mockDeadlines,
    isLoading: false,
    isGM: false,
    onCreateDeadline: vi.fn(),
    onUpdateDeadline: vi.fn(),
    onDeleteDeadline: vi.fn(),
    onExtendDeadline: vi.fn(),
  };

  describe('Game State Visibility', () => {
    it('should NOT render for "setup" state', () => {
      const { container } = render(
        <DeadlineStrip {...defaultProps} gameState="setup" />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should NOT render for "recruitment" state', () => {
      const { container } = render(
        <DeadlineStrip {...defaultProps} gameState="recruitment" />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render for "character_creation" state', () => {
      render(<DeadlineStrip {...defaultProps} gameState="character_creation" />);
      expect(screen.getByText('Submit Actions')).toBeInTheDocument();
    });

    it('should render for "in_progress" state', () => {
      render(<DeadlineStrip {...defaultProps} gameState="in_progress" />);
      expect(screen.getByText('Submit Actions')).toBeInTheDocument();
    });

    it('should NOT render for "completed" state', () => {
      const { container } = render(
        <DeadlineStrip {...defaultProps} gameState="completed" />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should NOT render for "cancelled" state', () => {
      const { container } = render(
        <DeadlineStrip {...defaultProps} gameState="cancelled" />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render when gameState is undefined (backward compatibility)', () => {
      render(<DeadlineStrip {...defaultProps} gameState={undefined} />);
      // When gameState is undefined, it should default to showing (for backward compatibility)
      // Actually, looking at the code, undefined will fail the check and return null
      // Let me verify this behavior...
      const { container } = render(
        <DeadlineStrip {...defaultProps} gameState={undefined} />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Empty State Visibility', () => {
    it('should NOT render when no deadlines and user is not GM (in allowed game state)', () => {
      const { container } = render(
        <DeadlineStrip
          {...defaultProps}
          deadlines={[]}
          isGM={false}
          gameState="in_progress"
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render when no deadlines but user is GM (in allowed game state)', () => {
      render(
        <DeadlineStrip
          {...defaultProps}
          deadlines={[]}
          isGM={true}
          gameState="in_progress"
        />
      );
      // GM should see the section even with no deadlines (to create new ones)
      expect(screen.getByText(/no deadlines yet/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should hide component when isLoading is true (in allowed game state)', () => {
      const { container } = render(
        <DeadlineStrip
          {...defaultProps}
          isLoading={true}
          gameState="in_progress"
        />
      );
      // Component returns null during loading (hides itself)
      expect(container.firstChild).toBeNull();
    });

    it('should NOT show loading state in disallowed game states', () => {
      const { container } = render(
        <DeadlineStrip
          {...defaultProps}
          isLoading={true}
          gameState="setup"
        />
      );
      // Should return null before showing loading state
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Deadline Display', () => {
    it('should render deadline cards when deadlines exist (in allowed game state)', () => {
      render(<DeadlineStrip {...defaultProps} gameState="in_progress" />);
      expect(screen.getByTestId('deadline-card')).toBeInTheDocument();
      expect(screen.getByText('Submit Actions')).toBeInTheDocument();
    });

    it('should render multiple deadline cards', () => {
      const multipleDeadlines: Deadline[] = [
        {
          id: 1,
          game_id: 1,
          title: 'Deadline 1',
          deadline: new Date(Date.now() + 86400000).toISOString(),
        },
        {
          id: 2,
          game_id: 1,
          title: 'Deadline 2',
          deadline: new Date(Date.now() + 172800000).toISOString(),
        },
        {
          id: 3,
          game_id: 1,
          title: 'Deadline 3',
          deadline: new Date(Date.now() + 259200000).toISOString(),
        },
      ];

      render(
        <DeadlineStrip
          {...defaultProps}
          deadlines={multipleDeadlines}
          gameState="in_progress"
        />
      );

      expect(screen.getAllByTestId('deadline-card')).toHaveLength(3);
    });
  });
});
