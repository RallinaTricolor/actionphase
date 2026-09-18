import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test-utils/render';
import { makeMessage, makeMutationResult, makeQueryResult } from '../test-utils';
import { DraftPostSection } from './DraftPostSection';
import type { Message } from '../types/messages';

vi.mock('../hooks', async () => {
  const actual = await vi.importActual<typeof import('../hooks')>('../hooks');
  return {
    ...actual,
    useDraftPost: vi.fn(),
    useCreateDraftPost: vi.fn(),
    useUpdateDraftPost: vi.fn(),
    useDeleteDraftPost: vi.fn(),
  };
});

vi.mock('../contexts/GameContext', async () => {
  const actual = await vi.importActual<typeof import('../contexts/GameContext')>('../contexts/GameContext');
  return {
    ...actual,
    useOptionalGameContext: vi.fn(() => ({
      userCharacters: [{ id: 1, name: 'Narrator' }],
      allGameCharacters: [{ id: 1, name: 'Narrator' }],
    })),
  };
});

const { useDraftPost, useCreateDraftPost, useUpdateDraftPost, useDeleteDraftPost } = await import('../hooks');

/**
 * The "no draft" case is mocked as `null`, which is what the endpoint sends:
 * "A phase with no draft answers 200 with a null body, not 404" (the
 * getDraftPost operation's own description in messages/huma_api.go).
 * DraftPostSection branches on `draft === null || draft === undefined`.
 *
 * `undefined` is kept for exactly one case -- the loading test -- because that
 * is what React Query holds before the first response, and it is the other
 * half of the component's branch.
 *
 * The generated spec still says plain MessageResponse rather than a nullable
 * body, and cannot say otherwise: huma panics on `nullable:"true"` for a
 * struct ref, supporting nullable scalars only. The API client declares
 * `Message | null` to carry the null the schema cannot.
 */

const mockDraft: Message = makeMessage({
  id: 42,
  game_id: 1,
  phase_id: 10,
  author_id: 1,
  character_id: 1,
  content: 'The fog which surrounded you dissipates and you find yourself in a grand hall.',
  message_type: 'post',
  thread_depth: 0,
  author_username: 'gm_user',
  character_name: 'Narrator',
  is_edited: false,
  is_deleted: false,
  is_draft: true,
  created_at: '2025-11-01T10:00:00Z',
  updated_at: '2025-11-01T10:00:00Z',
});

const makeMutationStub = makeMutationResult;

describe('DraftPostSection', () => {
  const mockOnCreateDraft = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCreateDraftPost).mockReturnValue(makeMutationStub());
    vi.mocked(useUpdateDraftPost).mockReturnValue(makeMutationStub());
    vi.mocked(useDeleteDraftPost).mockReturnValue(makeMutationStub());
  });

  it('shows loading state while fetching', () => {
    vi.mocked(useDraftPost).mockReturnValue(makeQueryResult<Message | null>({
      data: undefined,
      isLoading: true,
      isSuccess: false,
      isError: false,
    }));

    renderWithProviders(<DraftPostSection phaseId={10} onCreateDraft={mockOnCreateDraft} />);
    // Loading state shows an animated placeholder (no text to assert, just no crash)
  });

  it('shows "No draft post" and add button when no draft exists', () => {
    vi.mocked(useDraftPost).mockReturnValue(makeQueryResult<Message | null>({
      data: null,
      isLoading: false,
      isSuccess: true,
      isError: false,
    }));

    renderWithProviders(<DraftPostSection phaseId={10} onCreateDraft={mockOnCreateDraft} />);

    expect(screen.getByText('No draft post')).toBeInTheDocument();
    expect(screen.getByTestId('add-draft-post-btn')).toBeInTheDocument();
  });

  it('shows draft preview when draft exists', () => {
    vi.mocked(useDraftPost).mockReturnValue(makeQueryResult<Message | null>({
      data: mockDraft,
      isLoading: false,
      isSuccess: true,
      isError: false,
    }));

    renderWithProviders(<DraftPostSection phaseId={10} onCreateDraft={mockOnCreateDraft} />);

    expect(screen.getByText(/The fog which surrounded you/)).toBeInTheDocument();
    expect(screen.getByTestId('edit-draft-btn')).toBeInTheDocument();
    expect(screen.getByTestId('preview-draft-btn')).toBeInTheDocument();
    expect(screen.getByTestId('delete-draft-btn')).toBeInTheDocument();
  });

  it('opens create modal when add button is clicked', () => {
    vi.mocked(useDraftPost).mockReturnValue(makeQueryResult<Message | null>({
      data: null,
      isLoading: false,
      isSuccess: true,
      isError: false,
    }));

    renderWithProviders(<DraftPostSection phaseId={10} onCreateDraft={mockOnCreateDraft} />);

    fireEvent.click(screen.getByTestId('add-draft-post-btn'));
    expect(screen.getByText('Write Draft Opening Post')).toBeInTheDocument();
  });

  it('shows delete confirmation when delete is clicked', () => {
    vi.mocked(useDraftPost).mockReturnValue(makeQueryResult<Message | null>({
      data: mockDraft,
      isLoading: false,
      isSuccess: true,
      isError: false,
    }));

    renderWithProviders(<DraftPostSection phaseId={10} onCreateDraft={mockOnCreateDraft} />);

    fireEvent.click(screen.getByTestId('delete-draft-btn'));
    expect(screen.getByText('Delete?')).toBeInTheDocument();
  });

  it('calls delete mutation when confirmation is accepted', async () => {
    const mockDelete = makeMutationResult<void, void>();
    vi.mocked(useDeleteDraftPost).mockReturnValue(mockDelete);

    vi.mocked(useDraftPost).mockReturnValue(makeQueryResult<Message | null>({
      data: mockDraft,
      isLoading: false,
      isSuccess: true,
      isError: false,
    }));

    renderWithProviders(<DraftPostSection phaseId={10} onCreateDraft={mockOnCreateDraft} />);

    fireEvent.click(screen.getByTestId('delete-draft-btn'));
    fireEvent.click(screen.getByText('Yes'));

    await waitFor(() => expect(mockDelete.mutate).toHaveBeenCalled());
  });

  it('opens preview modal when preview is clicked', () => {
    vi.mocked(useDraftPost).mockReturnValue(makeQueryResult<Message | null>({
      data: mockDraft,
      isLoading: false,
      isSuccess: true,
      isError: false,
    }));

    renderWithProviders(<DraftPostSection phaseId={10} onCreateDraft={mockOnCreateDraft} />);

    fireEvent.click(screen.getByTestId('preview-draft-btn'));
    expect(screen.getByText('Draft Post Preview')).toBeInTheDocument();
  });
});
