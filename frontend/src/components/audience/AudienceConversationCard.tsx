import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { AudienceConversationListItem } from '../../types/conversations';
import { Badge, Card, CardBody } from '../ui';
import CharacterAvatar from '../CharacterAvatar';

interface AudienceConversationCardProps {
  conversation: AudienceConversationListItem;
  onClick: () => void;
  isSelected?: boolean;
}

export const AudienceConversationCard: React.FC<AudienceConversationCardProps> = ({
  conversation,
  onClick,
  isSelected = false
}) => {
  // Calculate activity level based on message count
  const getActivityBadge = (count: number) => {
    if (count >= 21) {
      return { variant: 'primary' as const, label: `${count} messages` };
    }
    if (count >= 6) {
      return { variant: 'secondary' as const, label: `${count} messages` };
    }
    return { variant: 'neutral' as const, label: `${count}` };
  };

  // Check if conversation had activity in last 24 hours
  const isRecentActivity = () => {
    if (!conversation.last_message_at) return false;
    const lastMessageDate = new Date(conversation.last_message_at);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return lastMessageDate > dayAgo;
  };

  // Format participant names for display
  const getParticipantDisplay = () => {
    if (!conversation.participant_names || conversation.participant_names.length === 0) {
      return 'No participants';
    }
    return conversation.participant_names.join(', ');
  };

  // Get up to 4 participant initials for avatars
  const getParticipantAvatars = () => {
    if (!conversation.participant_names) return [];
    return conversation.participant_names.slice(0, 4);
  };

  const additionalParticipants = conversation.participant_names
    ? Math.max(0, conversation.participant_names.length - 4)
    : 0;

  const activityBadge = getActivityBadge(conversation.message_count);
  const hasRecentActivity = isRecentActivity();

  return (
    <Card
      variant={isSelected ? 'bordered' : 'default'}
      padding="md"
      className={`
        cursor-pointer
        transition-all
        duration-200
        hover:shadow-lg
        ${isSelected ? 'border-l-4 border-l-blue-500 bg-bg-secondary' : 'hover:bg-bg-secondary'}
      `}
      onClick={onClick}
    >
      <CardBody>
        <div className="flex flex-col gap-3">
          {/* Header: Avatars + Recent indicator */}
          <div className="flex items-start justify-between gap-2">
            {/* Participant Avatars (Slack-style overlap) */}
            <div className="flex items-center -space-x-2">
              {getParticipantAvatars().map((name, index) => (
                <div
                  key={index}
                  className="rounded-full border-2 border-bg-primary shadow-sm"
                  style={{ zIndex: getParticipantAvatars().length - index }}
                  title={name}
                >
                  <CharacterAvatar
                    characterName={name}
                    avatarUrl={conversation.participant_avatar_urls?.[index]}
                    size="md"
                  />
                </div>
              ))}
              {additionalParticipants > 0 && (
                <div
                  className="h-10 w-10 rounded-full bg-content-tertiary text-white flex items-center justify-center text-xs font-medium border-2 border-bg-primary shadow-sm"
                  style={{ zIndex: 0 }}
                  title={`+${additionalParticipants} more`}
                >
                  +{additionalParticipants}
                </div>
              )}
            </div>

            {/* Recent activity indicator */}
            {hasRecentActivity && (
              <div className="flex items-center gap-1.5" title="Active in last 24 hours">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-xs text-content-secondary hidden sm:inline">Recent</span>
              </div>
            )}
          </div>

          {/* Title/Subject */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-bold text-content-primary line-clamp-1">
              {conversation.subject || 'Conversation'}
            </h3>
            <Badge variant={activityBadge.variant} size="sm">
              {activityBadge.label}
            </Badge>
          </div>

          {/* Participants */}
          <p className="text-sm text-content-secondary line-clamp-1">
            {getParticipantDisplay()}
          </p>

          {/* Last Message Preview */}
          {conversation.last_message_content && conversation.last_sender_name && (
            <div className="flex flex-col gap-1">
              <p className="text-sm text-content-primary line-clamp-2">
                <span className="font-medium text-content-primary">
                  {conversation.last_sender_name}:
                </span>{' '}
                {conversation.last_message_content}
              </p>
            </div>
          )}

          {/* Timestamp */}
          {conversation.last_message_at && (
            <p className="text-xs text-content-tertiary">
              {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })}
            </p>
          )}
        </div>
      </CardBody>
    </Card>
  );
};
