import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AudienceConversationHeader } from './AudienceConversationHeader';
import type { AudienceConversationListItem } from '../../types/conversations';

describe('AudienceConversationHeader', () => {
  const mockConversation: AudienceConversationListItem = {
    conversation_id: 1,
    subject: 'Planning the Heist',
    conversation_type: 'group',
    created_at: '2025-01-01T10:00:00Z',
    message_count: 15,
    last_message_at: '2025-01-15T14:30:00Z',
    participant_names: ['Alice', 'Bob', 'Charlie'],
    participant_usernames: ['alice', 'bob', 'charlie'],
    last_message_content: 'Ready to go!',
    last_sender_name: 'Alice',
    last_sender_username: 'alice',
    last_sender_avatar_url: null,
  };

  it('renders conversation subject', () => {
    render(
      <AudienceConversationHeader
        conversation={mockConversation}
        messageCount={15}
        onBack={vi.fn()}
      />
    );

    // Appears twice (mobile + desktop layouts)
    const subjectTexts = screen.getAllByText('Planning the Heist');
    expect(subjectTexts.length).toBeGreaterThan(0);
  });

  it('renders Read-Only badge', () => {
    render(
      <AudienceConversationHeader
        conversation={mockConversation}
        messageCount={15}
        onBack={vi.fn()}
      />
    );

    // Appears twice (mobile + desktop layouts)
    const badgeTexts = screen.getAllByText('Read-Only');
    expect(badgeTexts.length).toBeGreaterThan(0);
  });

  it('renders message count with singular form', () => {
    render(
      <AudienceConversationHeader
        conversation={mockConversation}
        messageCount={1}
        onBack={vi.fn()}
      />
    );

    // Appears twice (mobile + desktop layouts)
    const messageTexts = screen.getAllByText('1 message');
    expect(messageTexts.length).toBeGreaterThan(0);
  });

  it('renders message count with plural form', () => {
    render(
      <AudienceConversationHeader
        conversation={mockConversation}
        messageCount={15}
        onBack={vi.fn()}
      />
    );

    // Appears twice (mobile + desktop layouts)
    const messageTexts = screen.getAllByText('15 messages');
    expect(messageTexts.length).toBeGreaterThan(0);
  });

  it('calls onBack when back button is clicked', async () => {
    const user = userEvent.setup();
    const handleBack = vi.fn();

    render(
      <AudienceConversationHeader
        conversation={mockConversation}
        messageCount={15}
        onBack={handleBack}
      />
    );

    // Find all back buttons (mobile and desktop)
    const backButtons = screen.getAllByRole('button', { name: /back/i });
    await user.click(backButtons[0]);

    expect(handleBack).toHaveBeenCalledTimes(1);
  });

  it('renders participant names', () => {
    render(
      <AudienceConversationHeader
        conversation={mockConversation}
        messageCount={15}
        onBack={vi.fn()}
      />
    );

    // Appears twice (mobile + desktop layouts)
    const participantTexts = screen.getAllByText('Alice, Bob, Charlie');
    expect(participantTexts.length).toBeGreaterThan(0);
  });

  it('renders participant avatars', () => {
    render(
      <AudienceConversationHeader
        conversation={mockConversation}
        messageCount={15}
        onBack={vi.fn()}
      />
    );

    // Should render CharacterAvatar components for each participant
    const avatars = screen.getAllByTestId('character-avatar');
    expect(avatars.length).toBeGreaterThan(0);
  });

  it('shows "+X more" indicator when more than 5 participants', () => {
    const manyParticipants = {
      ...mockConversation,
      participant_names: ['Alice', 'Bob', 'Charlie', 'Dave', 'Eve', 'Frank', 'Grace'],
    };

    render(
      <AudienceConversationHeader
        conversation={manyParticipants}
        messageCount={15}
        onBack={vi.fn()}
      />
    );

    // Appears twice (mobile + desktop layouts)
    const moreIndicators = screen.getAllByText('+2');
    expect(moreIndicators.length).toBeGreaterThan(0);
  });

  it('renders up to 5 participant avatars', () => {
    const manyParticipants = {
      ...mockConversation,
      participant_names: ['Alice', 'Bob', 'Charlie', 'Dave', 'Eve', 'Frank'],
    };

    render(
      <AudienceConversationHeader
        conversation={manyParticipants}
        messageCount={15}
        onBack={vi.fn()}
      />
    );

    const avatars = screen.getAllByTestId('character-avatar');
    // Should render exactly 5 avatars (max) even though there are 6 participants
    // Each avatar appears twice (mobile + desktop layout)
    expect(avatars.length).toBe(10); // 5 avatars × 2 (mobile + desktop)
  });

  it('uses default subject when subject is null', () => {
    render(
      <AudienceConversationHeader
        conversation={{ ...mockConversation, subject: null }}
        messageCount={15}
        onBack={vi.fn()}
      />
    );

    // Appears twice (mobile + desktop layouts)
    const conversationTexts = screen.getAllByText('Conversation');
    expect(conversationTexts.length).toBeGreaterThan(0);
  });

  it('handles empty participant list', () => {
    const noParticipants = {
      ...mockConversation,
      participant_names: [],
    };

    render(
      <AudienceConversationHeader
        conversation={noParticipants}
        messageCount={0}
        onBack={vi.fn()}
      />
    );

    // Appears twice (mobile + desktop layouts)
    const noParticipantTexts = screen.getAllByText('No participants');
    expect(noParticipantTexts.length).toBeGreaterThan(0);
  });

  it('has sticky positioning', () => {
    const { container } = render(
      <AudienceConversationHeader
        conversation={mockConversation}
        messageCount={15}
        onBack={vi.fn()}
      />
    );

    const header = container.querySelector('.sticky');
    expect(header).toBeInTheDocument();
  });

  it('renders both mobile and desktop layouts', () => {
    const { container } = render(
      <AudienceConversationHeader
        conversation={mockConversation}
        messageCount={15}
        onBack={vi.fn()}
      />
    );

    // Mobile layout should have md:hidden class
    const mobileLayout = container.querySelector('.md\\:hidden');
    expect(mobileLayout).toBeInTheDocument();

    // Desktop layout should have hidden md:flex class
    const desktopLayout = container.querySelector('.md\\:flex');
    expect(desktopLayout).toBeInTheDocument();
  });

  it('renders zero messages correctly', () => {
    render(
      <AudienceConversationHeader
        conversation={mockConversation}
        messageCount={0}
        onBack={vi.fn()}
      />
    );

    // Appears twice (mobile + desktop layouts)
    const zeroMessagesTexts = screen.getAllByText('0 messages');
    expect(zeroMessagesTexts.length).toBeGreaterThan(0);
  });
});
