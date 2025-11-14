import { useState, useEffect } from 'react';
import { usePoll, usePollResults, useUserCharacters, usePolls } from '../hooks';
import { Card, CardHeader, CardBody, Button, Badge, Spinner } from './ui';
import { MarkdownPreview } from './MarkdownPreview';
import { PollVotingForm } from './PollVotingForm';
import { PollResults } from './PollResults';
import { ConfirmModal } from './ConfirmModal';
import type { Poll } from '../types/polls';

interface PollCardProps {
  poll: Poll;
  gameId: number;
  isGM: boolean;
  isAudience?: boolean;
}

export function PollCard({ poll, gameId, isGM, isAudience = false }: PollCardProps) {
  // Fetch user's characters for character-level polls
  const { characters } = useUserCharacters(gameId);
  const [showVotingForm, setShowVotingForm] = useState(false);
  const [isChangingVote, setIsChangingVote] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Get delete mutation from usePolls hook
  const { deletePollMutation } = usePolls(gameId);

  // Compute is_expired client-side (backend doesn't provide it)
  const isExpired = new Date(poll.deadline) < new Date();

  // Calculate initial showResults state with permission check
  // Players can only see results on expired polls
  // GMs and audience can see results anytime (even on active polls)
  const initialShowResults =
    (isExpired || poll.user_has_voted) && // User has voted or poll expired
    (isExpired || isGM || isAudience);     // AND user has permission to view

  const [showResults, setShowResults] = useState(initialShowResults);

  // Sync showResults state when poll data changes (after cache invalidation)
  useEffect(() => {
    // Determine if results should be shown based on user permissions
    const shouldShowResults =
      (isExpired || poll.user_has_voted) && // User has voted or poll expired
      (isExpired || isGM || isAudience);     // AND user has permission to view

    setShowResults(shouldShowResults);
  }, [isExpired, poll.user_has_voted, isGM, isAudience]);

  // Fetch full poll details when needed
  const { data: fullPoll, isLoading: pollLoading } = usePoll(showVotingForm ? poll.id : null);

  // Fetch results when showing results
  const { data: results, isLoading: resultsLoading } = usePollResults(showResults ? poll.id : null);

  const formatDeadline = (deadline: string) => {
    const date = new Date(deadline);
    const now = new Date();
    const isExpired = date < now;

    return {
      text: date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }),
      isExpired
    };
  };

  const deadlineInfo = formatDeadline(poll.deadline);

  const handleDeletePoll = async () => {
    try {
      await deletePollMutation.mutateAsync(poll.id);
      setShowDeleteConfirm(false);
    } catch (error) {
      // Error will be handled by the mutation
      console.error('Failed to delete poll:', error);
    }
  };

  return (
    <Card variant="default" padding="md">
      <CardHeader>
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <h4 className="text-lg font-semibold text-text-heading">{poll.question}</h4>

            {/* Metadata row */}
            <div className="flex items-center gap-3 mt-2 text-sm text-text-secondary">
              <span>Vote as: {poll.vote_as_type === 'player' ? 'Player' : 'Character'}</span>
              <span>•</span>
              <span>
                {deadlineInfo.isExpired ? 'Ended' : 'Ends'}: {deadlineInfo.text}
              </span>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            {isExpired ? (
              <Badge variant="secondary">Expired</Badge>
            ) : poll.vote_as_type === 'character' && poll.voted_character_ids && poll.voted_character_ids.length > 0 ? (
              // Character poll: Show voting progress
              poll.voted_character_ids.length >= characters.length ? (
                <Badge variant="success">Voted ({poll.voted_character_ids.length}/{characters.length})</Badge>
              ) : (
                <Badge variant="primary">Voted ({poll.voted_character_ids.length}/{characters.length})</Badge>
              )
            ) : poll.user_has_voted ? (
              <Badge variant="success">Voted</Badge>
            ) : !isGM && !isAudience ? (
              // Only show "Not Voted" for players (GMs and audience can't vote)
              <Badge variant="warning">Not Voted</Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardBody>
        {/* Description */}
        {poll.description && (
          <div className="mb-4">
            <MarkdownPreview content={poll.description} />
          </div>
        )}

        {/* Voting Form or Results */}
        {showVotingForm && !isExpired ? (
          pollLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="md" label="Loading poll options..." />
            </div>
          ) : fullPoll ? (
            <PollVotingForm
              poll={fullPoll}
              isChangingVote={isChangingVote}
              onSuccess={() => {
                setShowVotingForm(false);
                setIsChangingVote(false);
                // Only show results if user is allowed to view them
                // Players can only see results on expired polls
                // GMs and audience can see results anytime
                if (isExpired || isGM || isAudience) {
                  setShowResults(true);
                }
              }}
              onCancel={() => {
                setShowVotingForm(false);
                setIsChangingVote(false);
              }}
            />
          ) : null
        ) : showResults ? (
          resultsLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="md" label="Loading results..." />
            </div>
          ) : results ? (
            <PollResults results={results} poll={poll} isGM={isGM} isAudience={isAudience} />
          ) : null
        ) : null}

        {/* Action Buttons */}
        {!showVotingForm && !isExpired && (
          <div className="flex gap-2 mt-4">
            {/* Show "Vote Now" if: user hasn't voted OR (character poll AND has more characters to vote with) */}
            {(!poll.user_has_voted || (poll.vote_as_type === 'character' && (poll.voted_character_ids?.length || 0) < characters.length)) && !isGM && !isAudience && (
              <Button
                variant="primary"
                onClick={() => {
                  setIsChangingVote(false);
                  setShowVotingForm(true);
                }}
              >
                Vote Now
              </Button>
            )}
            {/* Show "Change Vote" button if user has already voted (player polls or partial character polls) */}
            {poll.user_has_voted && !isGM && !isAudience && (
              <Button
                variant="secondary"
                onClick={() => {
                  setIsChangingVote(true);
                  setShowVotingForm(true);
                }}
              >
                Change Vote
              </Button>
            )}
            {/* Show Results button: GM and audience can always see, players only after expiration */}
            {(isGM || isAudience) && (
              <Button
                variant="secondary"
                onClick={() => setShowResults(!showResults)}
              >
                {showResults ? 'Hide Results' : 'Show Results'}
              </Button>
            )}
            {/* Delete button: GM only */}
            {isGM && (
              <Button
                variant="danger"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete Poll
              </Button>
            )}
          </div>
        )}

        {isExpired && !showResults && (
          <Button
            variant="secondary"
            onClick={() => setShowResults(true)}
            className="mt-4"
          >
            Show Results
          </Button>
        )}
      </CardBody>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeletePoll}
        title="Delete Poll"
        message="Are you sure you want to delete this poll? All votes and results will be permanently removed. This action cannot be undone."
        confirmText="Delete Poll"
        variant="danger"
        isLoading={deletePollMutation.isPending}
      />
    </Card>
  );
}
