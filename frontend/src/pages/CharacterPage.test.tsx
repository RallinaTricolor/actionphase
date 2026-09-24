import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { UseQueryResult } from '@tanstack/react-query';
import { CharacterPage } from './CharacterPage';
import { stubRenderedHeight } from '../test-utils/renderedHeight';
import { makeInfiniteQueryResult, makeQueryResult } from '../test-utils/factories';
import * as useCharacterCommentsModule from '../hooks/useCharacterComments';
import * as useCharacterStatsModule from '../hooks/useCharacterStats';
import type {
  Character,
  CharacterActivityStats,
  CharacterData,
} from '../types/characters';
import type { CharacterMessage, CharacterMessagesResponse } from '../types/messages';

// Mock hooks
vi.mock('../hooks/useCharacterComments');
vi.mock('../hooks/useCharacterStats');

// The envelope shortcut has its own suite; stub its gate so this file's blanket
// useQuery mock (which answers every query with the character) doesn't feed it
// a phase payload it never sees in production.
vi.mock('../hooks/useCanMessageCharacter');
import { useCanMessageCharacter } from '../hooks/useCanMessageCharacter';

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

import { useQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn().mockReturnValue({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
});
window.IntersectionObserver = mockIntersectionObserver as unknown as typeof IntersectionObserver;

const mockCharacter: Character = {
  id: 42,
  game_id: 1,
  name: 'Aelindra',
  character_type: 'player_character',
  status: 'approved',
  avatar_url: undefined,
  is_active: true,
  username: 'testplayer',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const mockMessage: CharacterMessage = {
  id: 1,
  game_id: 1,
  parent_id: null,
  author_id: 10,
  character_id: 42,
  content: 'Hello world',
  message_type: 'post',
  created_at: '2025-03-01T10:00:00Z',
  edited_at: null,
  edit_count: 0,
  deleted_at: null,
  is_deleted: false,
  author_username: 'testplayer',
  character_name: 'Aelindra',
  character_avatar_url: null,
};

const mockComment: CharacterMessage = {
  ...mockMessage,
  id: 2,
  message_type: 'comment',
  content: 'A reply',
  parent: {
    content: 'Original post',
    created_at: '2025-03-01T09:00:00Z',
    deleted_at: null,
    is_deleted: false,
    message_type: 'post',
    author_username: 'someone',
    character_name: 'Other Character',
    character_avatar_url: null,
  },
};

// A real QueryClient, even though useQuery itself is mocked above: the page's
// favorite mutation calls useQueryClient, which reads the provider rather than
// the mocked hook and throws without one.
function renderCharacterPage(characterId = '42') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/characters/${characterId}`]}>
        <Routes>
          <Route path="/characters/:characterId" element={<CharacterPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/**
 * CharacterPage issues three useQuery calls: ['character', id],
 * ['characterData', id] and ['favoriteCommentIDs', 'all']. Tests stub the character result per-case via
 * mockCharacterQuery(); the characterData result defaults to [] and is set by
 * the bio tests. Routing on the query key keeps the array-shaped bio payload
 * from being answered with a character object.
 */
let characterQueryResult: Partial<UseQueryResult<Character>>;
let characterFieldsResult: CharacterData[] | undefined;
// The favorite-id set the page's star state reads from; the id-array shape
// matters, since the hook feeds it straight into `new Set(...)`.
let favoriteCommentIDs: number[];

function mockCharacterQuery(result: Partial<UseQueryResult<Character>>) {
  characterQueryResult = result;
}

describe('CharacterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    characterQueryResult = { data: undefined, isLoading: false, isError: false };
    characterFieldsResult = [];
    favoriteCommentIDs = [];

    vi.mocked(useQuery).mockImplementation((options: unknown) => {
      const key = (options as { queryKey?: unknown[] })?.queryKey;
      if (Array.isArray(key) && key[0] === 'characterData') {
        return { data: characterFieldsResult, isLoading: false, isError: false } as never;
      }
      if (Array.isArray(key) && key[0] === 'favoriteCommentIDs') {
        return { data: favoriteCommentIDs, isLoading: false, isError: false } as never;
      }
      return characterQueryResult as never;
    });
    // Default: no messaging affordance. Its own gate is covered by
    // useCanMessageCharacter's suite; stubbing it here also keeps this file's
    // blanket useQuery mock from feeding the real hook a phase payload it
    // would never receive in production.
    vi.mocked(useCanMessageCharacter).mockReturnValue({
      canMessage: false,
      gameId: undefined,
    });
    // Default: stats not loaded (undefined data)
    vi.mocked(useCharacterStatsModule.useCharacterStats).mockReturnValue(
      makeQueryResult<CharacterActivityStats>({
      data: undefined,
      isLoading: false,
      isError: false,
    }));
  });

  it('shows loading state while character loads', () => {
    mockCharacterQuery({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    vi.mocked(useCharacterCommentsModule.useCharacterComments).mockReturnValue(
      makeInfiniteQueryResult<CharacterMessagesResponse>({
      data: undefined,
      isLoading: true,
      isError: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    }));

    renderCharacterPage();

    // A whole-page spinner, not the header skeleton this page used to show.
    // The skeleton let the stats line and feed render beside it, which is the
    // structure that leaked a hidden NPC's comments before the 404 landed --
    // see 'renders no feed while the character is still loading'.
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows character name and avatar when loaded', () => {
    mockCharacterQuery({
      data: mockCharacter,
      isLoading: false,
      isError: false,
    });

    vi.mocked(useCharacterCommentsModule.useCharacterComments).mockReturnValue(
      makeInfiniteQueryResult<CharacterMessagesResponse>({
      data: {
        pages: [{ messages: [], pagination: { total: 0, limit: 20, offset: 0 } }],
        pageParams: [0],
      },
      isLoading: false,
      isError: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    }));

    renderCharacterPage();

    expect(screen.getByText('Aelindra')).toBeInTheDocument();
    expect(screen.getByText('@testplayer')).toBeInTheDocument();
  });

  it('shows empty state when character has no messages', () => {
    mockCharacterQuery({
      data: mockCharacter,
      isLoading: false,
      isError: false,
    });

    vi.mocked(useCharacterCommentsModule.useCharacterComments).mockReturnValue(
      makeInfiniteQueryResult<CharacterMessagesResponse>({
      data: {
        pages: [{ messages: [], pagination: { total: 0, limit: 20, offset: 0 } }],
        pageParams: [0],
      },
      isLoading: false,
      isError: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    }));

    renderCharacterPage();

    expect(screen.getByText(/no public activity yet/i)).toBeInTheDocument();
  });

  it('renders posts and comments in the activity feed', () => {
    mockCharacterQuery({
      data: mockCharacter,
      isLoading: false,
      isError: false,
    });

    vi.mocked(useCharacterCommentsModule.useCharacterComments).mockReturnValue(
      makeInfiniteQueryResult<CharacterMessagesResponse>({
      data: {
        pages: [{
          messages: [mockMessage, mockComment],
          pagination: { total: 2, limit: 20, offset: 0 },
        }],
        pageParams: [0],
      },
      isLoading: false,
      isError: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    }));

    renderCharacterPage();

    expect(screen.getByText('Hello world')).toBeInTheDocument();
    expect(screen.getByText('A reply')).toBeInTheDocument();
    // Content is present (badges removed from CharacterPage activity feed)
    expect(screen.getByText('Hello world')).toBeInTheDocument();
    expect(screen.getByText('A reply')).toBeInTheDocument();
  });

  it('shows error when messages fail to load', () => {
    mockCharacterQuery({
      data: mockCharacter,
      isLoading: false,
      isError: false,
    });

    vi.mocked(useCharacterCommentsModule.useCharacterComments).mockReturnValue(
      makeInfiniteQueryResult<CharacterMessagesResponse>({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network error'),
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    }));

    renderCharacterPage();

    expect(screen.getByText(/failed to load activity/i)).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  describe('character not found', () => {
    /**
     * A hidden NPC answers 404, and so does a nonexistent ID. Both land here.
     *
     * Regression test: the page used to render an inline "Failed to load
     * character" banner and keep going, so the stats line and the activity feed
     * -- which fetch independently of the character record -- still rendered. A
     * player who guessed a hidden NPC's ID got a partial profile with a red box
     * on top.
     */
    function renderNotFound(messages: CharacterMessage[] = [mockMessage]) {
      mockCharacterQuery({ data: undefined, isLoading: false, isError: true });

      vi.mocked(useCharacterStatsModule.useCharacterStats).mockReturnValue(
        makeQueryResult<CharacterActivityStats>({
          data: { public_messages: 7, private_messages: 3 },
          isLoading: false,
          isError: false,
        })
      );

      vi.mocked(useCharacterCommentsModule.useCharacterComments).mockReturnValue(
        makeInfiniteQueryResult<CharacterMessagesResponse>({
          data: {
            pages: [{ messages, pagination: { total: messages.length, limit: 20, offset: 0 } }],
            pageParams: [0],
          },
          isLoading: false,
          isError: false,
          fetchNextPage: vi.fn(),
          hasNextPage: false,
          isFetchingNextPage: false,
        })
      );

      return renderCharacterPage();
    }

    it('renders a not-found page instead of the profile', () => {
      renderNotFound();

      expect(screen.getByText('Character not found')).toBeInTheDocument();
      // The old inline banner must be gone, not merely supplemented.
      expect(screen.queryByText(/failed to load character/i)).not.toBeInTheDocument();
    });

    it('renders no activity feed', () => {
      renderNotFound();

      // The feed endpoint still answers 200 by design -- authored content stays
      // visible -- so the page, not the API, is what must withhold it here.
      expect(screen.queryByText('Hello world')).not.toBeInTheDocument();
      expect(screen.queryByText(/activity/i)).not.toBeInTheDocument();
    });

    it('renders no message counts', () => {
      renderNotFound();

      // This was the live leak: "Messages: 1 public" rendered beside the error.
      expect(screen.queryByText(/public/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/private/i)).not.toBeInTheDocument();
    });

    it('renders no feed while the character is still loading', () => {
      // The race this guards: the comments endpoint answers 200 and resolves
      // first, so a hidden NPC's feed painted for ~1s and was then replaced by
      // the 404. Anything gated on isError alone reopens that window.
      mockCharacterQuery({ data: undefined, isLoading: true, isError: false });

      vi.mocked(useCharacterStatsModule.useCharacterStats).mockReturnValue(
        makeQueryResult<CharacterActivityStats>({
          data: { public_messages: 7, private_messages: 3 },
          isLoading: false,
          isError: false,
        })
      );

      vi.mocked(useCharacterCommentsModule.useCharacterComments).mockReturnValue(
        makeInfiniteQueryResult<CharacterMessagesResponse>({
          data: {
            pages: [{ messages: [mockMessage], pagination: { total: 1, limit: 20, offset: 0 } }],
            pageParams: [0],
          },
          isLoading: false,
          isError: false,
          fetchNextPage: vi.fn(),
          hasNextPage: false,
          isFetchingNextPage: false,
        })
      );

      renderCharacterPage();

      expect(screen.queryByText('Hello world')).not.toBeInTheDocument();
      expect(screen.queryByText(/Messages:/)).not.toBeInTheDocument();
    });

    it('does not say whether the character exists', () => {
      renderNotFound();

      // A hidden NPC 404s precisely so it is indistinguishable from a bad ID.
      // Wording that distinguished them would undo the gate.
      expect(
        screen.getByText('No character exists at this address, or you cannot view it.')
      ).toBeInTheDocument();
    });
  });

  describe('favorite star', () => {
    function renderFeed(messages: CharacterMessage[]) {
      mockCharacterQuery({
        data: mockCharacter,
        isLoading: false,
        isError: false,
      });

      vi.mocked(useCharacterCommentsModule.useCharacterComments).mockReturnValue(
      makeInfiniteQueryResult<CharacterMessagesResponse>({
        data: {
          pages: [{
            messages,
            pagination: { total: messages.length, limit: 20, offset: 0 },
          }],
          pageParams: [0],
        },
        isLoading: false,
        isError: false,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
      }));

      return renderCharacterPage();
    }

    // This feed carries posts as well as comments, and only comments can be
    // favorited — so the star must key off message_type, not just render on
    // every card.
    it('shows a star on comments but not on posts', () => {
      renderFeed([mockMessage, mockComment]);

      expect(screen.getAllByTestId('favorite-button')).toHaveLength(1);
    });

    it('shows no star at all when the feed holds only posts', () => {
      renderFeed([mockMessage]);

      expect(screen.queryByTestId('favorite-button')).not.toBeInTheDocument();
    });

    // The page spans every game the character appears in, so star state comes
    // from the cross-game id set rather than a per-game one.
    it('shows the starred state for an id in the cross-game favorite set', () => {
      favoriteCommentIDs = [mockComment.id];

      renderFeed([mockMessage, mockComment]);

      expect(screen.getByRole('button', { name: /remove from favorites/i })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });

    it('shows the unstarred state for a comment outside the favorite set', () => {
      favoriteCommentIDs = [mockComment.id + 99];

      renderFeed([mockMessage, mockComment]);

      expect(screen.getByRole('button', { name: /favorite this comment/i })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });
  });

  it('shows "View in thread" link for non-deleted messages', () => {
    mockCharacterQuery({
      data: mockCharacter,
      isLoading: false,
      isError: false,
    });

    vi.mocked(useCharacterCommentsModule.useCharacterComments).mockReturnValue(
      makeInfiniteQueryResult<CharacterMessagesResponse>({
      data: {
        pages: [{
          messages: [mockMessage],
          pagination: { total: 1, limit: 20, offset: 0 },
        }],
        pageParams: [0],
      },
      isLoading: false,
      isError: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    }));

    renderCharacterPage();

    expect(screen.getByText(/view in thread/i)).toBeInTheDocument();
  });

  it('navigates to game thread when "View in thread" is clicked', () => {
    mockCharacterQuery({
      data: mockCharacter,
      isLoading: false,
      isError: false,
    });

    vi.mocked(useCharacterCommentsModule.useCharacterComments).mockReturnValue(
      makeInfiniteQueryResult<CharacterMessagesResponse>({
      data: {
        pages: [{
          messages: [mockMessage],
          pagination: { total: 1, limit: 20, offset: 0 },
        }],
        pageParams: [0],
      },
      isLoading: false,
      isError: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    }));

    renderCharacterPage();

    const link = screen.getByText(/view in thread/i);
    link.click();

    expect(mockNavigate).toHaveBeenCalledWith('/games/1?tab=common-room&comment=1');
  });

  it('shows public and private stats when both are returned', () => {
    mockCharacterQuery({
      data: mockCharacter,
      isLoading: false,
      isError: false,
    });

    vi.mocked(useCharacterCommentsModule.useCharacterComments).mockReturnValue(
      makeInfiniteQueryResult<CharacterMessagesResponse>({
      data: {
        pages: [{ messages: [], pagination: { total: 0, limit: 20, offset: 0 } }],
        pageParams: [0],
      },
      isLoading: false,
      isError: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    }));

    vi.mocked(useCharacterStatsModule.useCharacterStats).mockReturnValue(
      makeQueryResult<CharacterActivityStats>({
      data: { public_messages: 42, private_messages: 13 },
      isLoading: false,
      isError: false,
    }));

    renderCharacterPage();

    expect(screen.getByTestId('character-stats')).toBeInTheDocument();
    expect(screen.getByTestId('public-message-count')).toHaveTextContent('42');
    expect(screen.getByTestId('private-message-count')).toHaveTextContent('13');
  });

  it('shows only public stats when private_messages is absent', () => {
    mockCharacterQuery({
      data: mockCharacter,
      isLoading: false,
      isError: false,
    });

    vi.mocked(useCharacterCommentsModule.useCharacterComments).mockReturnValue(
      makeInfiniteQueryResult<CharacterMessagesResponse>({
      data: {
        pages: [{ messages: [], pagination: { total: 0, limit: 20, offset: 0 } }],
        pageParams: [0],
      },
      isLoading: false,
      isError: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    }));

    vi.mocked(useCharacterStatsModule.useCharacterStats).mockReturnValue(
      makeQueryResult<CharacterActivityStats>({
      data: { public_messages: 7 },
      isLoading: false,
      isError: false,
    }));

    renderCharacterPage();

    expect(screen.getByTestId('public-message-count')).toHaveTextContent('7');
    expect(screen.queryByTestId('private-message-count')).not.toBeInTheDocument();
  });

  it('shows invalid character ID error for non-numeric ID', () => {
    mockCharacterQuery({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    vi.mocked(useCharacterCommentsModule.useCharacterComments).mockReturnValue(
      makeInfiniteQueryResult<CharacterMessagesResponse>({
      data: undefined,
      isLoading: false,
      isError: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    }));

    renderCharacterPage('not-a-number');

    expect(screen.getByText(/invalid character id/i)).toBeInTheDocument();
  });

  it('shows character type badge when character_type is present', () => {
    mockCharacterQuery({
      data: { ...mockCharacter, character_type: 'player_character' },
      isLoading: false,
      isError: false,
    });

    vi.mocked(useCharacterCommentsModule.useCharacterComments).mockReturnValue(
      makeInfiniteQueryResult<CharacterMessagesResponse>({
      data: {
        pages: [{ messages: [], pagination: { total: 0, limit: 20, offset: 0 } }],
        pageParams: [0],
      },
      isLoading: false,
      isError: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    }));

    renderCharacterPage();

    expect(screen.getByText('Player Character')).toBeInTheDocument();
  });

  it('hides character type badge when character_type is absent (anonymous mode)', () => {
    const { character_type: _, ...characterWithoutType } = mockCharacter;
    mockCharacterQuery({
      data: characterWithoutType as Character,
      isLoading: false,
      isError: false,
    });

    vi.mocked(useCharacterCommentsModule.useCharacterComments).mockReturnValue(
      makeInfiniteQueryResult<CharacterMessagesResponse>({
      data: {
        pages: [{ messages: [], pagination: { total: 0, limit: 20, offset: 0 } }],
        pageParams: [0],
      },
      isLoading: false,
      isError: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    }));

    renderCharacterPage();

    expect(screen.queryByText('Player Character')).not.toBeInTheDocument();
    expect(screen.queryByText('NPC')).not.toBeInTheDocument();
    // Character name still renders
    expect(screen.getByText('Aelindra')).toBeInTheDocument();
  });

  describe('private message shortcut', () => {
    function renderLoadedPage() {
      mockCharacterQuery({
        data: mockCharacter,
        isLoading: false,
        isError: false,
      });

      vi.mocked(useCharacterCommentsModule.useCharacterComments).mockReturnValue(
      makeInfiniteQueryResult<CharacterMessagesResponse>({
        data: {
        pages: [{ messages: [], pagination: { total: 0, limit: 20, offset: 0 } }],
        pageParams: [0],
      },
        isLoading: false,
        isError: false,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
      }));

      return renderCharacterPage();
    }

    it('offers the envelope when the user may message this character', () => {
      vi.mocked(useCanMessageCharacter).mockReturnValue({ canMessage: true, gameId: 7 });

      renderLoadedPage();

      expect(
        screen.getByRole('button', { name: `Send a private message to ${mockCharacter.name}` })
      ).toBeInTheDocument();
    });

    it('omits the envelope when the user may not message this character', () => {
      renderLoadedPage();

      expect(
        screen.queryByRole('button', { name: /send a private message/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('public bio', () => {
    // CollapsibleMarkdown decides overflow from measured height; jsdom reports 0.
    const setBioHeight = stubRenderedHeight(500);

    function bioField(overrides: Partial<CharacterData> = {}): CharacterData {
      return {
        id: 1,
        character_id: 42,
        module_type: 'bio',
        field_name: 'background',
        field_value: 'A salt-marsh fisher-priest turned reluctant envoy.',
        field_type: 'text',
        is_public: true,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        ...overrides,
      };
    }

    function renderWithFields(fields: CharacterData[]) {
      mockCharacterQuery({
        data: mockCharacter,
        isLoading: false,
        isError: false,
      });

      vi.mocked(useCharacterCommentsModule.useCharacterComments).mockReturnValue(
      makeInfiniteQueryResult<CharacterMessagesResponse>({
        data: {
        pages: [{ messages: [], pagination: { total: 0, limit: 20, offset: 0 } }],
        pageParams: [0],
      },
        isLoading: false,
        isError: false,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
      }));

      characterFieldsResult = fields;
      return renderCharacterPage();
    }

    it('displays the public bio text', () => {
      renderWithFields([bioField()]);

      expect(
        screen.getByText('A salt-marsh fisher-priest turned reluctant envoy.')
      ).toBeInTheDocument();
    });

    it('omits the About section entirely when there is no bio', () => {
      renderWithFields([]);

      expect(screen.queryByRole('heading', { name: 'About' })).not.toBeInTheDocument();
    });

    it('omits the About section when the bio is only whitespace', () => {
      renderWithFields([bioField({ field_value: '   \n  ' })]);

      expect(screen.queryByRole('heading', { name: 'About' })).not.toBeInTheDocument();
    });

    it('does not render a private bio field', () => {
      renderWithFields([
        bioField({ field_value: 'Secret: she is the heir.', is_public: false }),
      ]);

      expect(screen.queryByText('Secret: she is the heir.')).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'About' })).not.toBeInTheDocument();
    });

    it('does not render private notes as the bio', () => {
      renderWithFields([
        bioField({
          module_type: 'notes',
          field_name: 'private_notes',
          field_value: 'Hidden motivations.',
          is_public: false,
        }),
      ]);

      expect(screen.queryByText('Hidden motivations.')).not.toBeInTheDocument();
    });

    it('shows a bio that fits in full, with no expand control', () => {
      setBioHeight(40); // fits inside the collapsed height
      renderWithFields([bioField({ field_value: 'Short and sweet.' })]);

      expect(screen.getByText('Short and sweet.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument();
      expect(screen.getByTestId('character-bio')).toHaveAttribute('data-collapsed', 'false');
    });

    it('collapses a bio that overflows behind Show More and expands on click', async () => {
      // Overflow is measured from rendered height, so the stub — not the source
      // length — is what makes this bio long.
      const longBio = 'A'.repeat(401);
      renderWithFields([bioField({ field_value: longBio })]);

      const toggle = screen.getByRole('button', { name: /show more/i });
      expect(screen.getByTestId('character-bio')).toHaveAttribute('data-collapsed', 'true');
      expect(toggle).toHaveAttribute('aria-expanded', 'false');

      await userEvent.click(toggle);

      expect(screen.getByTestId('character-bio')).toHaveAttribute('data-collapsed', 'false');
      expect(
        screen.getByRole('button', { name: /show less/i })
      ).toHaveAttribute('aria-expanded', 'true');
    });

    it('keeps the whole bio in the DOM while collapsed', () => {
      // Collapsing is visual: the markdown is never sliced, so a bio whose
      // clip point lands mid-syntax can't leak raw markup.
      renderWithFields([bioField({ field_value: 'B'.repeat(300) + ' **bold tail**' })]);

      expect(screen.getByText('bold tail').tagName).toBe('STRONG');
      expect(document.body.textContent).not.toContain('**');
    });
  });
});
