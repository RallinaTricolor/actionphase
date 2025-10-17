import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderWithProviders } from '../../test-utils/render';
import { GameResultsManager } from '../GameResultsManager';
import type { ActionResult } from '../../types/phases';

describe('GameResultsManager', () => {
  const mockGameId = 1;

  const mockUnpublishedResult: ActionResult = {
    id: 1,
    game_id: mockGameId,
    user_id: 100,
    phase_id: 1,
    gm_user_id: 1,
    content: 'This is an unpublished result for the player',
    is_published: false,
    sent_at: '2025-01-15T10:00:00Z',
    phase_type: 'action',
    phase_number: 1,
    gm_username: 'testgm',
    username: 'player1',
  };

  const mockPublishedResult: ActionResult = {
    id: 2,
    game_id: mockGameId,
    user_id: 101,
    phase_id: 2,
    gm_user_id: 1,
    content: 'This is a published result that was sent',
    is_published: true,
    sent_at: '2025-01-16T14:30:00Z',
    phase_type: 'action',
    phase_number: 2,
    gm_username: 'testgm',
    username: 'player2',
  };

  const mockUnpublishedResult2: ActionResult = {
    id: 3,
    game_id: mockGameId,
    user_id: 102,
    phase_id: 1,
    gm_user_id: 1,
    content: 'Another unpublished draft result',
    is_published: false,
    sent_at: '2025-01-15T11:00:00Z',
    username: 'player3',
  };

  const setupDefaultHandlers = (results: ActionResult[] = []) => {
    server.use(
      http.get('/api/v1/games/:gameId/results', () => {
        return HttpResponse.json(results);
      }),
      http.put('/api/v1/games/:gameId/results/:resultId', async ({ request }) => {
        const body = await request.json() as { content: string };
        return HttpResponse.json({
          ...mockUnpublishedResult,
          content: body.content,
        });
      })
    );
  };

  beforeEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('shows loading state initially', () => {
      server.use(
        http.get('/api/v1/games/:gameId/results', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json([]);
        })
      );

      const { container } = renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      // Loading skeleton should be present (with animate-pulse class)
      const loadingContainer = container.querySelector('.animate-pulse');
      expect(loadingContainer).toBeInTheDocument();
    });

    it('renders empty state when no results exist', async () => {
      setupDefaultHandlers([]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByText('Action Results')).toBeInTheDocument();
        expect(screen.getByText('No results have been created yet.')).toBeInTheDocument();
      });
    });

    it('renders header with title and description', async () => {
      setupDefaultHandlers([mockUnpublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByText('Action Results')).toBeInTheDocument();
        expect(screen.getByText('Manage results sent to players')).toBeInTheDocument();
      });
    });

    it('applies custom className when provided', async () => {
      setupDefaultHandlers([mockUnpublishedResult]);

      const { container } = renderWithProviders(
        <GameResultsManager gameId={mockGameId} className="custom-class" />
      );

      await waitFor(() => {
        const mainContainer = container.querySelector('.custom-class');
        expect(mainContainer).toBeInTheDocument();
      });
    });
  });

  describe('Result Counts Display', () => {
    it('displays correct count badges for unpublished and published results', async () => {
      setupDefaultHandlers([
        mockUnpublishedResult,
        mockUnpublishedResult2,
        mockPublishedResult,
      ]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByText('2 Unpublished')).toBeInTheDocument();
        expect(screen.getByText('1 Published')).toBeInTheDocument();
      });
    });

    it('shows zero count when no unpublished results', async () => {
      setupDefaultHandlers([mockPublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByText('0 Unpublished')).toBeInTheDocument();
        expect(screen.getByText('1 Published')).toBeInTheDocument();
      });
    });

    it('shows zero count when no published results', async () => {
      setupDefaultHandlers([mockUnpublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByText('1 Unpublished')).toBeInTheDocument();
        expect(screen.getByText('0 Published')).toBeInTheDocument();
      });
    });
  });

  describe('Unpublished Results Section', () => {
    it('displays unpublished results section when unpublished results exist', async () => {
      setupDefaultHandlers([mockUnpublishedResult, mockUnpublishedResult2]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByText('Unpublished Results (Editable)')).toBeInTheDocument();
      });
    });

    it('does not show unpublished section when no unpublished results', async () => {
      setupDefaultHandlers([mockPublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.queryByText('Unpublished Results (Editable)')).not.toBeInTheDocument();
      });
    });

    it('displays unpublished result content', async () => {
      setupDefaultHandlers([mockUnpublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByText('This is an unpublished result for the player')).toBeInTheDocument();
      });
    });

    it('displays username for unpublished results', async () => {
      setupDefaultHandlers([mockUnpublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByText('To: player1')).toBeInTheDocument();
      });
    });

    it('displays user ID when username is not available', async () => {
      const resultWithoutUsername: ActionResult = {
        ...mockUnpublishedResult,
        username: undefined,
      };
      setupDefaultHandlers([resultWithoutUsername]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByText('To: User #100')).toBeInTheDocument();
      });
    });

    it('displays draft badge for unpublished results', async () => {
      setupDefaultHandlers([mockUnpublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByText('Draft')).toBeInTheDocument();
      });
    });

    it('displays phase information when available', async () => {
      setupDefaultHandlers([mockUnpublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByText('Phase 1')).toBeInTheDocument();
      });
    });

    it('shows Edit button for unpublished results', async () => {
      setupDefaultHandlers([mockUnpublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      });
    });

    it('displays multiple unpublished results', async () => {
      setupDefaultHandlers([mockUnpublishedResult, mockUnpublishedResult2]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByText('This is an unpublished result for the player')).toBeInTheDocument();
        expect(screen.getByText('Another unpublished draft result')).toBeInTheDocument();
      });
    });
  });

  describe('Published Results Section', () => {
    it('displays published results section when published results exist', async () => {
      setupDefaultHandlers([mockPublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByText('Published Results')).toBeInTheDocument();
      });
    });

    it('does not show published section when no published results', async () => {
      setupDefaultHandlers([mockUnpublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.queryByText('Published Results')).not.toBeInTheDocument();
      });
    });

    it('displays published result content', async () => {
      setupDefaultHandlers([mockPublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByText('This is a published result that was sent')).toBeInTheDocument();
      });
    });

    it('displays username for published results', async () => {
      setupDefaultHandlers([mockPublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByText('To: player2')).toBeInTheDocument();
      });
    });

    it('displays sent timestamp for published results', async () => {
      setupDefaultHandlers([mockPublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        // Date format can vary by locale, so just check for presence of date-like pattern
        const sentText = screen.getByText(/Sent:/);
        expect(sentText).toBeInTheDocument();
      });
    });

    it('does not show Edit button for published results', async () => {
      setupDefaultHandlers([mockPublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Edit Functionality', () => {
    it('shows edit form when Edit button is clicked', async () => {
      const user = userEvent.setup();
      setupDefaultHandlers([mockUnpublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      });

      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveValue('This is an unpublished result for the player');
    });

    it('shows Save Changes and Cancel buttons in edit mode', async () => {
      const user = userEvent.setup();
      setupDefaultHandlers([mockUnpublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /edit/i }));

      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('hides Edit button when in edit mode', async () => {
      const user = userEvent.setup();
      setupDefaultHandlers([mockUnpublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /edit/i }));

      // The Edit button should no longer be visible
      const editButtons = screen.queryAllByRole('button', { name: /^edit$/i });
      expect(editButtons).toHaveLength(0);
    });

    it('allows editing content in textarea', async () => {
      const user = userEvent.setup();
      setupDefaultHandlers([mockUnpublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /edit/i }));

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'Updated content for the result');

      expect(textarea).toHaveValue('Updated content for the result');
    });

    it('closes edit form and reverts changes when Cancel is clicked', async () => {
      const user = userEvent.setup();
      setupDefaultHandlers([mockUnpublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /edit/i }));

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'Changed content');

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      // Edit form should be closed
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      // Original content should still be displayed
      expect(screen.getByText('This is an unpublished result for the player')).toBeInTheDocument();
    });

    it('successfully saves changes when Save Changes is clicked', async () => {
      const user = userEvent.setup();
      setupDefaultHandlers([mockUnpublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /edit/i }));

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'Updated result content');

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        // Edit form should be closed
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      });
    });

    it('trims whitespace from content before saving', async () => {
      const user = userEvent.setup();
      let requestBody: any = null;

      server.use(
        http.get('/api/v1/games/:gameId/results', () => {
          return HttpResponse.json([mockUnpublishedResult]);
        }),
        http.put('/api/v1/games/:gameId/results/:resultId', async ({ request }) => {
          requestBody = await request.json();
          return HttpResponse.json({
            ...mockUnpublishedResult,
            content: requestBody.content,
          });
        })
      );

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /edit/i }));

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, '  Trimmed content  ');

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(requestBody).toEqual({ content: 'Trimmed content' });
      });
    });

    it('does not save when content is unchanged', async () => {
      const user = userEvent.setup();
      setupDefaultHandlers([mockUnpublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /edit/i }));

      // Don't change anything, just click save
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        // Edit form should be closed
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      });
    });

    it('disables Save button when content is empty', async () => {
      const user = userEvent.setup();
      setupDefaultHandlers([mockUnpublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /edit/i }));

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      expect(saveButton).toBeDisabled();
    });

    it('disables Save button when content is only whitespace', async () => {
      const user = userEvent.setup();
      setupDefaultHandlers([mockUnpublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /edit/i }));

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, '   ');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      expect(saveButton).toBeDisabled();
    });

    it('can edit only one result at a time', async () => {
      const user = userEvent.setup();
      setupDefaultHandlers([mockUnpublishedResult, mockUnpublishedResult2]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: /edit/i });
        expect(editButtons).toHaveLength(2);
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      // Only one textarea should be visible
      const textareas = screen.getAllByRole('textbox');
      expect(textareas).toHaveLength(1);
    });
  });

  describe('Loading States', () => {
    it('shows loading text while saving changes', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('/api/v1/games/:gameId/results', () => {
          return HttpResponse.json([mockUnpublishedResult]);
        }),
        http.put('/api/v1/games/:gameId/results/:resultId', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json(mockUnpublishedResult);
        })
      );

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /edit/i }));

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'Updated content');

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('disables form controls while saving', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('/api/v1/games/:gameId/results', () => {
          return HttpResponse.json([mockUnpublishedResult]);
        }),
        http.put('/api/v1/games/:gameId/results/:resultId', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json(mockUnpublishedResult);
        })
      );

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /edit/i }));

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'Updated content');

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /saving\.\.\./i })).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('shows error message when save fails', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('/api/v1/games/:gameId/results', () => {
          return HttpResponse.json([mockUnpublishedResult]);
        }),
        http.put('/api/v1/games/:gameId/results/:resultId', () => {
          return HttpResponse.json(
            { error: 'Failed to update result' },
            { status: 500 }
          );
        })
      );

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /edit/i }));

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'Updated content');

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByText('Failed to update result. Please try again.')).toBeInTheDocument();
      });
    });

    it('keeps edit form open when save fails', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('/api/v1/games/:gameId/results', () => {
          return HttpResponse.json([mockUnpublishedResult]);
        }),
        http.put('/api/v1/games/:gameId/results/:resultId', () => {
          return HttpResponse.json(
            { error: 'Failed to update result' },
            { status: 500 }
          );
        })
      );

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /edit/i }));

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'Updated content');

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByText('Failed to update result. Please try again.')).toBeInTheDocument();
      });

      // Edit form should still be open with the content
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveValue('Updated content');
    });
  });

  describe('Styling and Visual States', () => {
    it('applies different styling to unpublished results', async () => {
      setupDefaultHandlers([mockUnpublishedResult]);

      const { container } = renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        const unpublishedCard = container.querySelector('.border-amber-200');
        expect(unpublishedCard).toBeInTheDocument();
      });
    });

    it('applies different styling to published results', async () => {
      setupDefaultHandlers([mockPublishedResult]);

      const { container } = renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        const publishedCard = container.querySelector('.border-green-200');
        expect(publishedCard).toBeInTheDocument();
      });
    });

    it('displays warning icon for unpublished section', async () => {
      setupDefaultHandlers([mockUnpublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByText('Unpublished Results (Editable)')).toBeInTheDocument();
      });

      // Check for warning icon (svg path)
      const heading = screen.getByText('Unpublished Results (Editable)');
      const svg = heading.closest('h3')?.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('displays check icon for published section', async () => {
      setupDefaultHandlers([mockPublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByText('Published Results')).toBeInTheDocument();
      });

      // Check for check icon (svg path)
      const heading = screen.getByText('Published Results');
      const svg = heading.closest('h3')?.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('preserves whitespace in result content display', async () => {
      const resultWithWhitespace: ActionResult = {
        ...mockUnpublishedResult,
        content: 'Line 1\n\nLine 2\n  Indented',
      };
      setupDefaultHandlers([resultWithWhitespace]);

      const { container } = renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        const contentDiv = container.querySelector('.whitespace-pre-wrap');
        expect(contentDiv).toBeInTheDocument();
        // Check that the content includes all the pieces of text
        expect(contentDiv).toHaveTextContent('Line 1');
        expect(contentDiv).toHaveTextContent('Line 2');
        expect(contentDiv).toHaveTextContent('Indented');
      });
    });
  });

  describe('Integration', () => {
    it('handles complete edit workflow', async () => {
      const user = userEvent.setup();
      setupDefaultHandlers([mockUnpublishedResult]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      // Wait for results to load
      await waitFor(() => {
        expect(screen.getByText('This is an unpublished result for the player')).toBeInTheDocument();
      });

      // Click Edit
      await user.click(screen.getByRole('button', { name: /edit/i }));

      // Modify content
      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'Completely new content');

      // Save changes
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      // Verify edit form is closed
      await waitFor(() => {
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      });
    });

    it('handles editing multiple results sequentially', async () => {
      const user = userEvent.setup();
      setupDefaultHandlers([mockUnpublishedResult, mockUnpublishedResult2]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /edit/i })).toHaveLength(2);
      });

      // Edit first result
      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      let textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'Updated first result');

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      });

      // Edit second result
      const newEditButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(newEditButtons[1]);

      textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'Updated second result');

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      });
    });

    it('displays both unpublished and published sections together', async () => {
      setupDefaultHandlers([
        mockUnpublishedResult,
        mockUnpublishedResult2,
        mockPublishedResult,
      ]);

      renderWithProviders(<GameResultsManager gameId={mockGameId} />);

      await waitFor(() => {
        expect(screen.getByText('Unpublished Results (Editable)')).toBeInTheDocument();
        expect(screen.getByText('Published Results')).toBeInTheDocument();
        expect(screen.getByText('This is an unpublished result for the player')).toBeInTheDocument();
        expect(screen.getByText('Another unpublished draft result')).toBeInTheDocument();
        expect(screen.getByText('This is a published result that was sent')).toBeInTheDocument();
      });
    });
  });
});
