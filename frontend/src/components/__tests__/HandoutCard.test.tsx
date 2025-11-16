import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils/render';
import { HandoutCard } from '../HandoutCard';
import type { Handout } from '../../types/handouts';

const publishedHandout: Handout = {
  id: 1,
  game_id: 1,
  title: 'Player Handbook',
  content: '# Welcome\n\nThis is the player handbook.',
  status: 'published',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T12:00:00Z',
};

const draftHandout: Handout = {
  id: 2,
  game_id: 1,
  title: 'Draft Document',
  content: '# Draft\n\nNot yet published.',
  status: 'draft',
  created_at: '2024-01-02T00:00:00Z',
  updated_at: '2024-01-02T12:00:00Z',
};

describe('HandoutCard', () => {
  const mockOnView = vi.fn();
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnPublish = vi.fn();
  const mockOnUnpublish = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  describe('Rendering', () => {
    it('renders handout title', () => {
      renderWithProviders(
        <HandoutCard
          handout={publishedHandout}
          isGM={false}
          onView={mockOnView}
        />
      );

      expect(screen.getByText('Player Handbook')).toBeInTheDocument();
    });

    it('renders Published badge for published handout', () => {
      renderWithProviders(
        <HandoutCard
          handout={publishedHandout}
          isGM={false}
          onView={mockOnView}
        />
      );

      expect(screen.getByText('Published')).toBeInTheDocument();
    });

    it('renders Draft badge for draft handout', () => {
      renderWithProviders(
        <HandoutCard
          handout={draftHandout}
          isGM={true}
          onView={mockOnView}
        />
      );

      expect(screen.getByText('Draft')).toBeInTheDocument();
    });

    it('renders updated timestamp', () => {
      renderWithProviders(
        <HandoutCard
          handout={publishedHandout}
          isGM={false}
          onView={mockOnView}
        />
      );

      expect(screen.getByText(/updated/i)).toBeInTheDocument();
    });

    it('renders View button', () => {
      renderWithProviders(
        <HandoutCard
          handout={publishedHandout}
          isGM={false}
          onView={mockOnView}
        />
      );

      expect(screen.getByRole('button', { name: /view/i })).toBeInTheDocument();
    });
  });

  describe('Player View', () => {
    it('does not render Edit button for players', () => {
      renderWithProviders(
        <HandoutCard
          handout={publishedHandout}
          isGM={false}
          onView={mockOnView}
        />
      );

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    });

    it('does not render Delete button for players', () => {
      renderWithProviders(
        <HandoutCard
          handout={publishedHandout}
          isGM={false}
          onView={mockOnView}
        />
      );

      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('does not render Publish button for players', () => {
      renderWithProviders(
        <HandoutCard
          handout={draftHandout}
          isGM={false}
          onView={mockOnView}
        />
      );

      expect(screen.queryByRole('button', { name: /publish/i })).not.toBeInTheDocument();
    });
  });

  describe('GM View', () => {
    it('renders Edit button for GM', () => {
      renderWithProviders(
        <HandoutCard
          handout={publishedHandout}
          isGM={true}
          onView={mockOnView}
          onEdit={mockOnEdit}
        />
      );

      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });

    it('renders Delete button for GM', () => {
      renderWithProviders(
        <HandoutCard
          handout={publishedHandout}
          isGM={true}
          onView={mockOnView}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('renders Publish button for draft handout', () => {
      renderWithProviders(
        <HandoutCard
          handout={draftHandout}
          isGM={true}
          onView={mockOnView}
          onPublish={mockOnPublish}
        />
      );

      expect(screen.getByRole('button', { name: /^publish$/i })).toBeInTheDocument();
    });

    it('renders Unpublish button for published handout', () => {
      renderWithProviders(
        <HandoutCard
          handout={publishedHandout}
          isGM={true}
          onView={mockOnView}
          onUnpublish={mockOnUnpublish}
        />
      );

      expect(screen.getByRole('button', { name: /unpublish/i })).toBeInTheDocument();
    });

    it('does not render Publish button for published handout', () => {
      renderWithProviders(
        <HandoutCard
          handout={publishedHandout}
          isGM={true}
          onView={mockOnView}
          onPublish={mockOnPublish}
        />
      );

      expect(screen.queryByRole('button', { name: /^publish$/i })).not.toBeInTheDocument();
    });

    it('does not render Unpublish button for draft handout', () => {
      renderWithProviders(
        <HandoutCard
          handout={draftHandout}
          isGM={true}
          onView={mockOnView}
          onUnpublish={mockOnUnpublish}
        />
      );

      expect(screen.queryByRole('button', { name: /unpublish/i })).not.toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('calls onView when View button clicked', async () => {
      const _user = userEvent.setup();

      renderWithProviders(
        <HandoutCard
          handout={publishedHandout}
          isGM={false}
          onView={mockOnView}
        />
      );

      const viewButton = screen.getByRole('button', { name: /view/i });
      await user.click(viewButton);

      expect(mockOnView).toHaveBeenCalledWith(publishedHandout);
    });

    it('calls onEdit when Edit button clicked', async () => {
      const _user = userEvent.setup();

      renderWithProviders(
        <HandoutCard
          handout={publishedHandout}
          isGM={true}
          onView={mockOnView}
          onEdit={mockOnEdit}
        />
      );

      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      expect(mockOnEdit).toHaveBeenCalledWith(publishedHandout);
    });

    it('calls onPublish when Publish button clicked', async () => {
      const _user = userEvent.setup();

      renderWithProviders(
        <HandoutCard
          handout={draftHandout}
          isGM={true}
          onView={mockOnView}
          onPublish={mockOnPublish}
        />
      );

      const publishButton = screen.getByRole('button', { name: /^publish$/i });
      await user.click(publishButton);

      expect(mockOnPublish).toHaveBeenCalledWith(draftHandout);
    });

    it('calls onUnpublish when Unpublish button clicked', async () => {
      const _user = userEvent.setup();

      renderWithProviders(
        <HandoutCard
          handout={publishedHandout}
          isGM={true}
          onView={mockOnView}
          onUnpublish={mockOnUnpublish}
        />
      );

      const unpublishButton = screen.getByRole('button', { name: /unpublish/i });
      await user.click(unpublishButton);

      expect(mockOnUnpublish).toHaveBeenCalledWith(publishedHandout);
    });

    it('shows confirmation dialog when Delete button clicked', async () => {
      const _user = userEvent.setup();

      renderWithProviders(
        <HandoutCard
          handout={publishedHandout}
          isGM={true}
          onView={mockOnView}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete "Player Handbook"?');
    });

    it('calls onDelete when deletion confirmed', async () => {
      const _user = userEvent.setup();

      renderWithProviders(
        <HandoutCard
          handout={publishedHandout}
          isGM={true}
          onView={mockOnView}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      expect(mockOnDelete).toHaveBeenCalledWith(publishedHandout);
    });

    it('does not call onDelete when deletion cancelled', async () => {
      const _user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      renderWithProviders(
        <HandoutCard
          handout={publishedHandout}
          isGM={true}
          onView={mockOnView}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      expect(mockOnDelete).not.toHaveBeenCalled();
    });
  });
});
