import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderWithProviders } from '../../test-utils/render';
import { MessageThread } from '../MessageThread';
import type { Character } from '../../types/characters';

describe('MessageThread', () => {
  const mockCharacters: Character[] = [
    {
      id: 1,
      game_id: 1,
      name: 'Hero Character',
      character_type: 'player_character',
      user_id: 100,
      status: 'approved',
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 2,
      game_id: 1,
      name: 'Companion Character',
      character_type: 'player_character',
      user_id: 100,
      status: 'approved',
      created_at: '2024-01-01T00:00:00Z',
    },
  ];

  const mockConversation = {
    conversation: {
      id: 1,
      game_id: 1,
      title: 'Test Conversation',
      created_at: '2024-01-01T00:00:00Z',
    },
    participants: [
      { character_id: 1, character_name: 'Hero Character', username: 'player1' },
      { character_id: 2, character_name: 'Companion Character', username: 'player1' },
    ],
  };

  const mockMessages = [
    {
      id: 1,
      conversation_id: 1,
      sender_character_id: 1,
      sender_character_name: 'Hero Character',
      sender_username: 'player1',
      content: 'Hello! This is the first message.',
      created_at: '2024-01-01T10:00:00Z',
    },
    {
      id: 2,
      conversation_id: 1,
      sender_character_id: 2,
      sender_character_name: 'Companion Character',
      sender_username: 'player1',
      content: 'This is a reply with **markdown** formatting!',
      created_at: '2024-01-01T10:05:00Z',
    },
  ];

  beforeEach(() => {
    // Setup default mocks
    server.use(
      http.get('/api/v1/games/:gameId/conversations/:conversationId', () => {
        return HttpResponse.json(mockConversation);
      }),
      http.get('/api/v1/games/:gameId/conversations/:conversationId/messages', () => {
        return HttpResponse.json({ messages: mockMessages });
      }),
      http.post('/api/v1/games/:gameId/conversations/:conversationId/read', () => {
        return HttpResponse.json({ success: true });
      })
    );
  });

  describe('Loading State', () => {
    it('shows loading indicator initially', () => {
      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      expect(screen.getByText(/loading messages/i)).toBeInTheDocument();
    });

    it('hides loading indicator after messages load', async () => {
      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      await waitFor(() => {
        expect(screen.queryByText(/loading messages/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error when conversation fails to load', async () => {
      server.use(
        http.get('/api/v1/games/:gameId/conversations/:conversationId', () => {
          return HttpResponse.error();
        })
      );

      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load conversation/i)).toBeInTheDocument();
      });
    });

    it('displays error when messages fail to load', async () => {
      server.use(
        http.get('/api/v1/games/:gameId/conversations/:conversationId/messages', () => {
          return HttpResponse.error();
        })
      );

      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load messages/i)).toBeInTheDocument();
      });
    });
  });

  describe('Conversation Display', () => {
    it('displays conversation title', async () => {
      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Conversation')).toBeInTheDocument();
      });
    });

    it('displays participant list', async () => {
      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      await waitFor(() => {
        expect(screen.getByText(/participants:/i)).toBeInTheDocument();
        // Character names appear in multiple places (participant list, character selector, messages)
        // so just verify they appear at least once
        const heroMatches = screen.getAllByText(/hero character/i);
        const companionMatches = screen.getAllByText(/companion character/i);
        expect(heroMatches.length).toBeGreaterThan(0);
        expect(companionMatches.length).toBeGreaterThan(0);
      });
    });

    it('shows untitled when conversation has no title', async () => {
      server.use(
        http.get('/api/v1/games/:gameId/conversations/:conversationId', () => {
          return HttpResponse.json({
            conversation: { id: 1, game_id: 1, title: null, created_at: '2024-01-01T00:00:00Z' },
            participants: mockConversation.participants,
          });
        })
      );

      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      await waitFor(() => {
        expect(screen.getByText(/untitled conversation/i)).toBeInTheDocument();
      });
    });
  });

  describe('Message Display', () => {
    it('displays all messages', async () => {
      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      await waitFor(() => {
        expect(screen.getByText(/hello! this is the first message/i)).toBeInTheDocument();
        expect(screen.getByText(/this is a reply/i)).toBeInTheDocument();
      });
    });

    it('displays sender names', async () => {
      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      await waitFor(() => {
        const senders = screen.getAllByText(/hero character|companion character/i);
        expect(senders.length).toBeGreaterThan(0);
      });
    });

    it('displays timestamps', async () => {
      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      await waitFor(() => {
        // Timestamps will be formatted, just check some exist
        const timeElements = screen.getAllByText(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i);
        expect(timeElements.length).toBeGreaterThan(0);
      });
    });

    it('renders markdown in messages', async () => {
      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      await waitFor(() => {
        // Check for markdown bold formatting (rendered as <strong>)
        const boldText = screen.getByText('markdown');
        expect(boldText.tagName).toBe('STRONG');
      });
    });

    it('shows empty state when no messages', async () => {
      server.use(
        http.get('/api/v1/games/:gameId/conversations/:conversationId/messages', () => {
          return HttpResponse.json({ messages: [] });
        })
      );

      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      await waitFor(() => {
        expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
        expect(screen.getByText(/start the conversation/i)).toBeInTheDocument();
      });
    });
  });

  describe('Message Input', () => {
    it('shows message input when user has participating characters', async () => {
      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/type your message/i)).toBeInTheDocument();
      });
    });

    it('shows character selector when user has multiple participants', async () => {
      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      await waitFor(() => {
        expect(screen.getByText(/send as hero character/i)).toBeInTheDocument();
        expect(screen.getByText(/send as companion character/i)).toBeInTheDocument();
      });
    });

    it('hides character selector when user has only one participant', async () => {
      const singleCharacter = [mockCharacters[0]];

      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={singleCharacter} />
      );

      await waitFor(() => {
        expect(screen.queryByText(/send as/i)).not.toBeInTheDocument();
      });
    });

    it('shows help text about keyboard shortcut', async () => {
      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      await waitFor(() => {
        expect(screen.getByText(/press ctrl\/cmd \+ enter to send/i)).toBeInTheDocument();
      });
    });

    it('shows message when user has no characters', async () => {
      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={[]} />
      );

      await waitFor(() => {
        expect(screen.getByText(/you need a character to send messages/i)).toBeInTheDocument();
      });
    });

    it('shows message when user has no participating characters', async () => {
      const nonParticipantCharacter: Character = {
        id: 99,
        game_id: 1,
        name: 'Non-Participant',
        character_type: 'player_character',
        user_id: 100,
        status: 'approved',
        created_at: '2024-01-01T00:00:00Z',
      };

      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={[nonParticipantCharacter]} />
      );

      await waitFor(() => {
        expect(screen.getByText(/you don't have any characters participating/i)).toBeInTheDocument();
      });
    });
  });

  describe('Sending Messages', () => {
    it('allows typing in message input', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/type your message/i)).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/type your message/i);
      await user.type(textarea, 'Test message');

      expect(textarea).toHaveValue('Test message');
    });

    it('sends message when form is submitted', async () => {
      const user = userEvent.setup();
      let sentMessage: any;

      server.use(
        http.post('/api/v1/games/:gameId/conversations/:conversationId/messages', async ({ request }) => {
          sentMessage = await request.json();
          return HttpResponse.json({
            id: 3, ...sentMessage, created_at: new Date().toISOString()
          });
        })
      );

      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/type your message/i)).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/type your message/i);
      await user.type(textarea, 'New test message');

      const sendButton = screen.getByRole('button', { name: /send/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(sentMessage).toBeDefined();
        expect(sentMessage.content).toBe('New test message');
      });
    });

    it('clears input after sending message', async () => {
      const user = userEvent.setup();

      server.use(
        http.post('/api/v1/games/:gameId/conversations/:conversationId/messages', () => {
          return HttpResponse.json({ id: 3 });
        })
      );

      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/type your message/i)).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/type your message/i);
      await user.type(textarea, 'Message to clear');
      await user.click(screen.getByRole('button', { name: /^send$/i }));

      await waitFor(() => {
        expect(textarea).toHaveValue('');
      });
    });

    it('shows sending state while message is being sent', async () => {
      const user = userEvent.setup();

      server.use(
        http.post('/api/v1/games/:gameId/conversations/:conversationId/messages', async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json({ id: 3 });
        })
      );

      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/type your message/i)).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText(/type your message/i), 'Test');
      await user.click(screen.getByRole('button', { name: /^send$/i }));

      expect(screen.getByText(/sending\.\.\./i)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText(/sending\.\.\./i)).not.toBeInTheDocument();
      });
    });

    it('disables send button when message is empty', async () => {
      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      await waitFor(() => {
        const sendButton = screen.getByRole('button', { name: /^send$/i });
        expect(sendButton).toBeDisabled();
      });
    });

    it('disables send button when message is only whitespace', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/type your message/i)).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/type your message/i);
      await user.type(textarea, '   '); // Only spaces

      const sendButton = screen.getByRole('button', { name: /^send$/i });
      expect(sendButton).toBeDisabled();
    });

    it('trims whitespace from message before sending', async () => {
      const user = userEvent.setup();
      let sentMessage: any;

      server.use(
        http.post('/api/v1/games/:gameId/conversations/:conversationId/messages', async ({ request }) => {
          sentMessage = await request.json();
          return HttpResponse.json({ id: 3 });
        })
      );

      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/type your message/i)).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText(/type your message/i), '  Trimmed message  ');
      await user.click(screen.getByRole('button', { name: /^send$/i }));

      await waitFor(() => {
        expect(sentMessage.content).toBe('Trimmed message');
      });
    });

    it('sends message with selected character ID', async () => {
      const user = userEvent.setup();
      let sentMessage: any;

      server.use(
        http.post('/api/v1/games/:gameId/conversations/:conversationId/messages', async ({ request }) => {
          sentMessage = await request.json();
          return HttpResponse.json({ id: 3 });
        })
      );

      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/type your message/i)).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText(/type your message/i), 'Test');
      await user.click(screen.getByRole('button', { name: /^send$/i }));

      await waitFor(() => {
        expect(sentMessage.character_id).toBe(1); // First character auto-selected
      });
    });

    it('allows switching character before sending', async () => {
      const user = userEvent.setup();
      let sentMessage: any;

      server.use(
        http.post('/api/v1/games/:gameId/conversations/:conversationId/messages', async ({ request }) => {
          sentMessage = await request.json();
          return HttpResponse.json({ id: 3 });
        })
      );

      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      await waitFor(() => {
        expect(screen.getByText(/send as hero character/i)).toBeInTheDocument();
      });

      // Select second character
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, '2');

      await user.type(screen.getByPlaceholderText(/type your message/i), 'Test');
      await user.click(screen.getByRole('button', { name: /^send$/i }));

      await waitFor(() => {
        expect(sentMessage.character_id).toBe(2);
      });
    });
  });

  describe('Marks Conversation as Read', () => {
    it('marks conversation as read when messages are loaded', async () => {
      let markedAsRead = false;

      server.use(
        http.post('/api/v1/games/:gameId/conversations/:conversationId/read', () => {
          markedAsRead = true;
          return HttpResponse.json({ success: true });
        })
      );

      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      await waitFor(() => {
        expect(markedAsRead).toBe(true);
      });
    });
  });

  describe('Character Selection Logic', () => {
    it('auto-selects first participating character', async () => {
      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mockCharacters} />
      );

      await waitFor(() => {
        const select = screen.getByRole('combobox') as HTMLSelectElement;
        expect(select.value).toBe('1'); // First character
      });
    });

    it('filters characters to only show conversation participants', async () => {
      const mixedCharacters: Character[] = [
        ...mockCharacters,
        {
          id: 99,
          game_id: 1,
          name: 'Non-Participant',
          character_type: 'player_character',
          user_id: 100,
          status: 'approved',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      renderWithProviders(
        <MessageThread gameId={1} conversationId={1} characters={mixedCharacters} />
      );

      await waitFor(() => {
        expect(screen.getByText(/send as hero character/i)).toBeInTheDocument();
        expect(screen.getByText(/send as companion character/i)).toBeInTheDocument();
        expect(screen.queryByText(/non-participant/i)).not.toBeInTheDocument();
      });
    });
  });
});
