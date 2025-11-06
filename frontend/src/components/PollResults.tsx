import type { PollResults as PollResultsType, Poll } from '../types/polls';

interface PollResultsProps {
  results: PollResultsType;
  poll: Poll;
}

export function PollResults({ results, poll }: PollResultsProps) {
  // Use total votes from backend (includes "other" votes)
  const totalVotes = results.total_votes;

  // Sort options by vote count (descending)
  const sortedOptions = [...results.option_results].sort((a, b) => b.vote_count - a.vote_count);

  return (
    <div className="space-y-4">
      {/* Results Header */}
      <div className="flex justify-between items-center pb-2 border-b border-border-primary">
        <h5 className="font-semibold text-text-heading">Results</h5>
        <span className="text-sm text-text-secondary">
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
        </span>
      </div>

      {/* No votes yet */}
      {totalVotes === 0 ? (
        <div className="text-center py-6 text-text-secondary">
          No votes yet
        </div>
      ) : (
        <div className="space-y-3">
          {sortedOptions.map((option) => {
            const percentage = totalVotes > 0 ? (option.vote_count / totalVotes) * 100 : 0;
            const isWinning = option.vote_count === sortedOptions[0].vote_count && option.vote_count > 0;

            return (
              <div key={option.poll_option_id || 'other'} className="space-y-2">
                {/* Option Header */}
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-text-primary">
                    {option.option_text || 'Other responses'}
                    {isWinning && sortedOptions[0].vote_count > 0 && (
                      <span className="ml-2 text-xs text-accent-primary">● Leading</span>
                    )}
                  </span>
                  <span className="text-sm text-text-secondary">
                    {option.vote_count} ({percentage.toFixed(1)}%)
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-bg-tertiary rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isWinning ? 'bg-accent-primary' : 'bg-bg-accent-secondary'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                {/* Individual Voters (if enabled) */}
                {poll.show_individual_votes && option.voters && option.voters.length > 0 && (
                  <div className="ml-4 text-xs text-text-secondary">
                    {option.voters.map((voter, idx) => (
                      <span key={idx}>
                        {poll.vote_as_type === 'character' ? voter.character_name : voter.username}
                        {voter.other_response && (
                          <span className="italic"> - "{voter.other_response}"</span>
                        )}
                        {idx < (option.voters?.length ?? 0) - 1 && ', '}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Other Responses Summary */}
      {!poll.show_individual_votes && results.other_responses.length > 0 && (
        <div className="text-xs text-text-secondary italic pt-2 border-t border-border-primary">
          {results.other_responses.length} custom {results.other_responses.length === 1 ? 'response' : 'responses'}
        </div>
      )}
    </div>
  );
}
