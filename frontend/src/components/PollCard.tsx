import { useState } from 'react';
import { usePoll, usePollResults } from '../hooks';
import { Card, CardHeader, CardBody, Button, Badge, Spinner } from './ui';
import { MarkdownPreview } from './MarkdownPreview';
import { PollVotingForm } from './PollVotingForm';
import { PollResults } from './PollResults';
import type { Poll } from '../types/polls';

interface PollCardProps {
  poll: Poll;
  gameId: number;
  isGM: boolean;
}

export function PollCard({ poll }: PollCardProps) {
  const [showVotingForm, setShowVotingForm] = useState(false);
  const [showResults, setShowResults] = useState(poll.is_expired || poll.user_has_voted);

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
            {poll.is_expired ? (
              <Badge variant="secondary">Expired</Badge>
            ) : poll.user_has_voted ? (
              <Badge variant="success">Voted</Badge>
            ) : (
              <Badge variant="warning">Not Voted</Badge>
            )}
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
        {showVotingForm && !poll.is_expired ? (
          pollLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="md" label="Loading poll options..." />
            </div>
          ) : fullPoll ? (
            <PollVotingForm
              poll={fullPoll}
              onSuccess={() => {
                setShowVotingForm(false);
                setShowResults(true);
              }}
              onCancel={() => setShowVotingForm(false)}
            />
          ) : null
        ) : showResults ? (
          resultsLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="md" label="Loading results..." />
            </div>
          ) : results ? (
            <PollResults results={results} poll={poll} />
          ) : null
        ) : null}

        {/* Action Buttons */}
        {!showVotingForm && !poll.is_expired && (
          <div className="flex gap-2 mt-4">
            {!poll.user_has_voted && (
              <Button
                variant="primary"
                onClick={() => setShowVotingForm(true)}
              >
                Vote Now
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => setShowResults(!showResults)}
            >
              {showResults ? 'Hide Results' : 'Show Results'}
            </Button>
          </div>
        )}

        {poll.is_expired && !showResults && (
          <Button
            variant="secondary"
            onClick={() => setShowResults(true)}
            className="mt-4"
          >
            Show Results
          </Button>
        )}
      </CardBody>
    </Card>
  );
}
