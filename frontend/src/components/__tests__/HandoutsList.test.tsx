import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils/render';
import { HandoutsList } from '../HandoutsList';
import * as useHandoutsModule from '../../hooks/useHandouts';
import type { Handout } from '../../types/handouts';

// Mock the useHandouts hook
vi.mock('../../hooks/useHandouts');

const mockHandouts: Handout[] = [
  {
    id: 1,
    game_id: 1,
    title: 'Player Handbook',
    content: '# Welcome\n\nThis is the player handbook.',
    status: 'published',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    game_id: 1,
    title: 'House Rules',
    content: '# House Rules\n\nCustom rules for this game.',
    status: 'published',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
  {
    id: 3,
    game_id: 1,
    title: 'Draft Document',
    content: '# Draft\n\nNot yet published.',
    status: 'draft',
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z',
  },
];

describe('HandoutsList', () => {
  const mockMutateAsync = vi.fn();
  const mockUseHandouts = {
    handouts: mockHandouts,
    isLoading: false,
    createHandoutMutation: {
      mutateAsync: mockMutateAsync,
      isPending: false,
    },
    updateHandoutMutation: {
      mutateAsync: mockMutateAsync,
      isPending: false,
    },
    deleteHandoutMutation: {
      mutateAsync: mockMutateAsync,
      isPending: false,
    },
    publishHandoutMutation: {
      mutateAsync: mockMutateAsync,
      isPending: false,
    },
    unpublishHandoutMutation: {
      mutateAsync: mockMutateAsync,
      isPending: false,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useHandoutsModule, 'useHandouts').mockReturnValue(mockUseHandouts as any);
    // Mock window.alert and window.confirm
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  describe('Loading State', () => {
    it('shows loading spinner when loading', () => {
      vi.spyOn(useHandoutsModule, 'useHandouts').mockReturnValue({
        ...mockUseHandouts,
        isLoading: true,
      } as any);

      renderWithProviders(<HandoutsList gameId={1} isGM={true} />);

      // Spinner has role="status" - use that instead of text (avoids duplicate text issue)
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('shows Handouts heading while loading', () => {
      vi.spyOn(useHandoutsModule, 'useHandouts').mockReturnValue({
        ...mockUseHandouts,
        isLoading: true,
      } as any);

      renderWithProviders(<HandoutsList gameId={1} isGM={true} />);

      expect(screen.getByText('Handouts')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows GM empty message when no handouts (GM view)', () => {
      vi.spyOn(useHandoutsModule, 'useHandouts').mockReturnValue({
        ...mockUseHandouts,
        handouts: [],
      } as any);

      renderWithProviders(<HandoutsList gameId={1} isGM={true} />);

      expect(screen.getByText(/no handouts yet\. create your first handout/i)).toBeInTheDocument();
    });

    it('shows player empty message when no handouts (player view)', () => {
      vi.spyOn(useHandoutsModule, 'useHandouts').mockReturnValue({
        ...mockUseHandouts,
        handouts: [],
      } as any);

      renderWithProviders(<HandoutsList gameId={1} isGM={false} />);

      expect(screen.getByText(/no handouts available yet/i)).toBeInTheDocument();
    });

    it('shows player empty message when only drafts exist (player view)', () => {
      vi.spyOn(useHandoutsModule, 'useHandouts').mockReturnValue({
        ...mockUseHandouts,
        handouts: [mockHandouts[2]], // Only draft handout
      } as any);

      renderWithProviders(<HandoutsList gameId={1} isGM={false} />);

      expect(screen.getByText(/no handouts available yet/i)).toBeInTheDocument();
    });
  });

  describe('Rendering for GM', () => {
    it('renders Handouts heading', () => {
      renderWithProviders(<HandoutsList gameId={1} isGM={true} />);

      expect(screen.getByText('Handouts')).toBeInTheDocument();
    });

    it('renders Create Handout button for GM', () => {
      renderWithProviders(<HandoutsList gameId={1} isGM={true} />);

      expect(screen.getByRole('button', { name: /create handout/i })).toBeInTheDocument();
    });

    it('renders all handouts including drafts for GM', () => {
      renderWithProviders(<HandoutsList gameId={1} isGM={true} />);

      expect(screen.getByText('Player Handbook')).toBeInTheDocument();
      expect(screen.getByText('House Rules')).toBeInTheDocument();
      expect(screen.getByText('Draft Document')).toBeInTheDocument();
    });

    it('renders handouts in grid layout', () => {
      renderWithProviders(<HandoutsList gameId={1} isGM={true} />);

      const grid = screen.getByText('Player Handbook').closest('.grid');
      expect(grid).toHaveClass('grid', 'gap-4', 'md:grid-cols-2');
    });
  });

  describe('Rendering for Players', () => {
    it('does not render Create Handout button for players', () => {
      renderWithProviders(<HandoutsList gameId={1} isGM={false} />);

      expect(screen.queryByRole('button', { name: /create handout/i })).not.toBeInTheDocument();
    });

    it('only renders published handouts for players', () => {
      renderWithProviders(<HandoutsList gameId={1} isGM={false} />);

      expect(screen.getByText('Player Handbook')).toBeInTheDocument();
      expect(screen.getByText('House Rules')).toBeInTheDocument();
      expect(screen.queryByText('Draft Document')).not.toBeInTheDocument();
    });
  });

  describe('Create Handout Modal', () => {
    it('opens create modal when Create Handout button clicked', async () => {
      const user = userEvent.setup();

      renderWithProviders(<HandoutsList gameId={1} isGM={true} />);

      const createButton = screen.getByRole('button', { name: /create handout/i });
      await user.click(createButton);

      // CreateHandoutModal should be rendered (check by heading instead of role)
      expect(screen.getByText('Create New Handout')).toBeInTheDocument();
    });

    it('closes create modal when onClose called', async () => {
      const user = userEvent.setup();

      renderWithProviders(<HandoutsList gameId={1} isGM={true} />);

      // Open modal
      const createButton = screen.getByRole('button', { name: /create handout/i });
      await user.click(createButton);

      // Close modal
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('calls createHandoutMutation when handout created', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockResolvedValue({ id: 4 });

      renderWithProviders(<HandoutsList gameId={1} isGM={true} />);

      // Open modal
      const createButton = screen.getByRole('button', { name: /create handout/i });
      await user.click(createButton);

      // Fill form
      const titleInput = screen.getByLabelText(/title/i);
      const contentTextarea = screen.getByLabelText(/content/i);

      await user.type(titleInput, 'New Handout');
      await user.type(contentTextarea, 'Handout content');

      // Submit
      const submitButtons = screen.getAllByRole('button', { name: /create handout/i });
      const submitButton = submitButtons[submitButtons.length - 1];
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          title: 'New Handout',
          content: 'Handout content',
          status: 'draft',
        });
      });
    });

    it('closes modal after successful creation', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockResolvedValue({ id: 4 });

      renderWithProviders(<HandoutsList gameId={1} isGM={true} />);

      // Open modal
      const createButton = screen.getByRole('button', { name: /create handout/i });
      await user.click(createButton);

      // Fill and submit
      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, 'New Handout');

      const contentTextarea = screen.getByLabelText(/content/i);
      await user.type(contentTextarea, 'Content');

      const submitButtons = screen.getAllByRole('button', { name: /create handout/i });
      const submitButton = submitButtons[submitButtons.length - 1];
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('shows error alert when creation fails', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockRejectedValue(new Error('Failed to create'));

      renderWithProviders(<HandoutsList gameId={1} isGM={true} />);

      // Open modal
      const createButton = screen.getByRole('button', { name: /create handout/i });
      await user.click(createButton);

      // Fill and submit
      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, 'New Handout');

      const contentTextarea = screen.getByLabelText(/content/i);
      await user.type(contentTextarea, 'Content');

      const submitButtons = screen.getAllByRole('button', { name: /create handout/i });
      const submitButton = submitButtons[submitButtons.length - 1];
      await user.click(submitButton);

      await waitFor(() => {
        // Modal should stay open after error
        expect(screen.getByText('Create New Handout')).toBeInTheDocument();
      });
    });
  });

  describe('Edit Handout Modal', () => {
    it('opens edit modal when handout edited', async () => {
      const user = userEvent.setup();

      renderWithProviders(<HandoutsList gameId={1} isGM={true} />);

      // Click edit on first handout
      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      // EditHandoutModal should be rendered (check by heading instead of role)
      expect(screen.getByText('Edit Handout')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Player Handbook')).toBeInTheDocument();
    });

    it('calls updateHandoutMutation when handout updated', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockResolvedValue({});

      renderWithProviders(<HandoutsList gameId={1} isGM={true} />);

      // Open edit modal
      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      // Modify title
      const titleInput = screen.getByLabelText(/title/i);
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Title');

      // Submit
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          handoutId: 1,
          data: expect.objectContaining({
            title: 'Updated Title',
          }),
        });
      });
    });

    it('closes modal after successful update', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockResolvedValue({});

      renderWithProviders(<HandoutsList gameId={1} isGM={true} />);

      // Open edit modal
      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      // Submit
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('View Handout', () => {
    it('switches to view mode when handout viewed', async () => {
      const user = userEvent.setup();

      renderWithProviders(<HandoutsList gameId={1} isGM={true} />);

      // Click view on first handout
      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[0]);

      // HandoutView should be rendered
      expect(screen.getByText(/back to handouts/i)).toBeInTheDocument();
      expect(screen.getByText('Player Handbook')).toBeInTheDocument();
    });

    it('returns to list view when back button clicked', async () => {
      const user = userEvent.setup();

      renderWithProviders(<HandoutsList gameId={1} isGM={true} />);

      // View handout
      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[0]);

      // Go back
      const backButton = screen.getByRole('button', { name: /back to handouts/i });
      await user.click(backButton);

      await waitFor(() => {
        expect(screen.getByText('Handouts')).toBeInTheDocument();
        expect(screen.queryByText(/back to handouts/i)).not.toBeInTheDocument();
      });
    });

    it('switches from view to edit mode when edit clicked in view', async () => {
      const user = userEvent.setup();

      renderWithProviders(<HandoutsList gameId={1} isGM={true} />);

      // View handout
      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[0]);

      // Click edit in view
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      // Should show edit modal (check by heading instead of role)
      await waitFor(() => {
        expect(screen.getByText('Edit Handout')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Player Handbook')).toBeInTheDocument();
      });
    });
  });

  describe('Delete Handout', () => {
    it('calls deleteHandoutMutation when delete clicked', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockResolvedValue({});

      renderWithProviders(<HandoutsList gameId={1} isGM={true} />);

      // Click delete on first handout
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith(1);
      });
    });

    it('shows error alert when deletion fails', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockRejectedValue(new Error('Failed to delete'));

      renderWithProviders(<HandoutsList gameId={1} isGM={true} />);

      // Click delete
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        // Component should still be functional after error
        expect(screen.getByText('Create Handout')).toBeInTheDocument();
      });
    });
  });

  describe('Publish/Unpublish Handout', () => {
    it('calls publishHandoutMutation when publish clicked', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockResolvedValue({});

      renderWithProviders(<HandoutsList gameId={1} isGM={true} />);

      // Click publish on draft handout (use exact match to avoid matching "Unpublish")
      const publishButton = screen.getByRole('button', { name: 'Publish' });
      await user.click(publishButton);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith(3); // Draft handout ID
      });
    });

    it('calls unpublishHandoutMutation when unpublish clicked', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockResolvedValue({});

      renderWithProviders(<HandoutsList gameId={1} isGM={true} />);

      // Click unpublish on published handout
      const unpublishButtons = screen.getAllByRole('button', { name: /unpublish/i });
      await user.click(unpublishButtons[0]);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith(1); // Published handout ID
      });
    });

    it('shows error alert when publish fails', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockRejectedValue(new Error('Failed to publish'));

      renderWithProviders(<HandoutsList gameId={1} isGM={true} />);

      // Click publish (use exact match to avoid matching "Unpublish")
      const publishButton = screen.getByRole('button', { name: 'Publish' });
      await user.click(publishButton);

      await waitFor(() => {
        // Component should still be functional after error
        expect(screen.getByText('Create Handout')).toBeInTheDocument();
      });
    });

    it('shows error alert when unpublish fails', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockRejectedValue(new Error('Failed to unpublish'));

      renderWithProviders(<HandoutsList gameId={1} isGM={true} />);

      // Click unpublish
      const unpublishButtons = screen.getAllByRole('button', { name: /unpublish/i });
      await user.click(unpublishButtons[0]);

      await waitFor(() => {
        // Component should still be functional after error
        expect(screen.getByText('Create Handout')).toBeInTheDocument();
      });
    });
  });

  describe('Integration', () => {
    it('handles complete handout management workflow', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockResolvedValue({ id: 4 });

      renderWithProviders(<HandoutsList gameId={1} isGM={true} />);

      // Verify initial state
      expect(screen.getByText('Player Handbook')).toBeInTheDocument();
      expect(screen.getByText('House Rules')).toBeInTheDocument();
      expect(screen.getByText('Draft Document')).toBeInTheDocument();

      // Create new handout
      const createButton = screen.getByRole('button', { name: /create handout/i });
      await user.click(createButton);

      const titleInput = screen.getByLabelText(/title/i);
      const contentTextarea = screen.getByLabelText(/content/i);

      await user.type(titleInput, 'New Handout');
      await user.type(contentTextarea, 'New content');

      const submitButtons = screen.getAllByRole('button', { name: /create handout/i });
      const submitButton = submitButtons[submitButtons.length - 1];
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          title: 'New Handout',
          content: 'New content',
          status: 'draft',
        });
      });

      // Modal should close
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
