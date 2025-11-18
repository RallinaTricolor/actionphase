import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AudienceConversationCard } from './AudienceConversationCard';
import type { AudienceConversationListItem } from '../../types/conversations';

describe('AudienceConversationCard', () => {
  const mockConversation: AudienceConversationListItem = {
    conversation_id: 1,
    subject: 'Test Conversation',
    conversation_type: 'group',
    created_at: '2025-01-01T10:00:00Z',
    message_count: 10,
    last_message_at: '2025-01-15T14:30:00Z',
    participant_names: ['Alice', 'Bob', 'Charlie'],
    participant_usernames: ['alice', 'bob', 'charlie'],
    last_message_content: 'This is the last message',
    last_sender_name: 'Alice',
    last_sender_username: 'alice',
    last_sender_avatar_url: null,
  };

  it('renders conversation subject', () => {
    render(
      <AudienceConversationCard
        conversation={mockConversation}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText('Test Conversation')).toBeInTheDocument();
  });

  it('renders participant names', () => {
    render(
      <AudienceConversationCard
        conversation={mockConversation}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText('Alice, Bob, Charlie')).toBeInTheDocument();
  });

  it('renders last message preview', () => {
    render(
      <AudienceConversationCard
        conversation={mockConversation}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText(/Alice:/)).toBeInTheDocument();
    expect(screen.getByText(/This is the last message/)).toBeInTheDocument();
  });

  it('calls onClick when card is clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    const { container } = render(
      <AudienceConversationCard
        conversation={mockConversation}
        onClick={handleClick}
      />
    );

    // Click on the card (cursor-pointer div)
    const card = container.querySelector('.cursor-pointer');
    if (!card) throw new Error('Card not found');

    await user.click(card);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows activity badge based on message count', () => {
    const { rerender } = render(
      <AudienceConversationCard
        conversation={{ ...mockConversation, message_count: 3 }}
        onClick={vi.fn()}
      />
    );

    // Low activity (1-5 messages) - should show just the count
    expect(screen.getByText('3')).toBeInTheDocument();

    // Medium activity (6-20 messages)
    rerender(
      <AudienceConversationCard
        conversation={{ ...mockConversation, message_count: 10 }}
        onClick={vi.fn()}
      />
    );
    expect(screen.getByText('10 messages')).toBeInTheDocument();

    // High activity (21+ messages)
    rerender(
      <AudienceConversationCard
        conversation={{ ...mockConversation, message_count: 25 }}
        onClick={vi.fn()}
      />
    );
    expect(screen.getByText('25 messages')).toBeInTheDocument();
  });

  it('shows recent activity indicator for messages within 24 hours', () => {
    const now = new Date();
    const recentTime = new Date(now.getTime() - 1000 * 60 * 60).toISOString(); // 1 hour ago

    render(
      <AudienceConversationCard
        conversation={{ ...mockConversation, last_message_at: recentTime }}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText('Recent')).toBeInTheDocument();
  });

  it('does not show recent activity indicator for old messages', () => {
    const oldTime = new Date('2025-01-01T10:00:00Z').toISOString(); // Old date

    render(
      <AudienceConversationCard
        conversation={{ ...mockConversation, last_message_at: oldTime }}
        onClick={vi.fn()}
      />
    );

    expect(screen.queryByText('Recent')).not.toBeInTheDocument();
  });

  it('renders avatars for up to 4 participants', () => {
    render(
      <AudienceConversationCard
        conversation={mockConversation}
        onClick={vi.fn()}
      />
    );

    // Should render 3 CharacterAvatar components (one for each participant)
    const avatars = screen.getAllByTestId('character-avatar');
    expect(avatars).toHaveLength(3);
  });

  it('shows "+X more" indicator when more than 4 participants', () => {
    const manyParticipants = {
      ...mockConversation,
      participant_names: ['Alice', 'Bob', 'Charlie', 'Dave', 'Eve', 'Frank'],
    };

    render(
      <AudienceConversationCard
        conversation={manyParticipants}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('applies selected styling when isSelected is true', () => {
    const { container } = render(
      <AudienceConversationCard
        conversation={mockConversation}
        onClick={vi.fn()}
        isSelected={true}
      />
    );

    // Check for selected styling classes
    const card = container.querySelector('.border-l-4');
    expect(card).toBeInTheDocument();
  });

  it('uses default subject when subject is null', () => {
    render(
      <AudienceConversationCard
        conversation={{ ...mockConversation, subject: null }}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText('Conversation')).toBeInTheDocument();
  });

  it('handles missing last message gracefully', () => {
    const noLastMessage = {
      ...mockConversation,
      last_message_content: null,
      last_sender_name: null,
    };

    render(
      <AudienceConversationCard
        conversation={noLastMessage}
        onClick={vi.fn()}
      />
    );

    // Should still render the card without errors
    expect(screen.getByText('Test Conversation')).toBeInTheDocument();
    expect(screen.queryByText(/:/)).not.toBeInTheDocument(); // No last message preview
  });

  it('renders relative timestamp', () => {
    render(
      <AudienceConversationCard
        conversation={mockConversation}
        onClick={vi.fn()}
      />
    );

    // Should show a relative time like "X days ago"
    expect(screen.getByText(/ago/)).toBeInTheDocument();
  });

  it('handles empty participant list', () => {
    const noParticipants = {
      ...mockConversation,
      participant_names: [],
    };

    render(
      <AudienceConversationCard
        conversation={noParticipants}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText('No participants')).toBeInTheDocument();
  });
});
