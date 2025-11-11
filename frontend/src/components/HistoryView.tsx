import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { getActionPhaseLabel, getActionPhaseColor } from '../types/phases';
import { CommonRoom } from './CommonRoom';
import { PhaseHistoryPolls } from './PhaseHistoryPolls';
import { Button, Alert } from './ui';
import { MarkdownPreview } from './MarkdownPreview';
import type { ActionWithDetails } from '../types/phases';

interface HistoryViewProps {
  gameId: number;
  currentPhaseId?: number;
  isGM?: boolean;
}

export function HistoryView({ gameId, currentPhaseId, isGM = false }: HistoryViewProps) {
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'submissions' | 'results' | 'polls'>('submissions');

  const { data: phasesData, isLoading } = useQuery({
    queryKey: ['gamePhases', gameId],
    queryFn: () => apiClient.phases.getGamePhases(gameId).then(res => res.data),
    enabled: !!gameId,
  });

  const phases = phasesData || [];

  // Fetch action results (use appropriate endpoint based on isGM)
  const { data: userActionResults, isLoading: isLoadingUserResults, error: userResultsError } = useQuery({
    queryKey: ['actionResults', 'user', gameId],
    queryFn: () => apiClient.phases.getUserResults(gameId).then(res => res.data),
    enabled: !!gameId && !isGM,
  });

  const { data: gmActionResults, isLoading: isLoadingGMResults, error: gmResultsError } = useQuery({
    queryKey: ['actionResults', 'game', gameId],
    queryFn: () => apiClient.phases.getGameResults(gameId).then(res => res.data),
    enabled: !!gameId && isGM,
  });

  // Use GM results if GM, otherwise user results
  const actionResults = isGM ? gmActionResults : userActionResults;
  const isLoadingResults = isGM ? isLoadingGMResults : isLoadingUserResults;
  const resultsError = isGM ? gmResultsError : userResultsError;

  // Fetch action submissions for the game (use appropriate endpoint based on isGM)
  const { data: userActionSubmissionsData, isLoading: isLoadingUserSubmissions, error: userSubmissionsError } = useQuery<ActionWithDetails[]>({
    queryKey: ['userActions', gameId],
    queryFn: () => apiClient.phases.getUserActions(gameId).then(res => res.data),
    enabled: !!gameId && !isGM,
  });

  const { data: gmActionSubmissionsData, isLoading: isLoadingGMSubmissions, error: gmSubmissionsError } = useQuery<ActionWithDetails[]>({
    queryKey: ['gameActions', gameId],
    queryFn: () => apiClient.phases.getGameActions(gameId).then(res => res.data),
    enabled: !!gameId && isGM,
  });

  // Use GM submissions if GM, otherwise user submissions
  const actionSubmissions = isGM ? (gmActionSubmissionsData || []) : (userActionSubmissionsData || []);
  const isLoadingSubmissions = isGM ? isLoadingGMSubmissions : isLoadingUserSubmissions;
  const submissionsError = isGM ? gmSubmissionsError : userSubmissionsError;

  // Get the selected phase details
  const selectedPhase = phases.find(p => p.id === selectedPhaseId);

  if (isLoading) {
    return (
      <div className="surface-base rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 surface-raised rounded mb-4 w-1/3"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 surface-raised rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (selectedPhaseId && selectedPhase) {
    // Show Common Room or Action Results for selected phase
    return (
      <div>
        <Button
          variant="ghost"
          onClick={() => setSelectedPhaseId(null)}
          className="mb-4 flex items-center text-interactive-primary hover:text-interactive-primary-hover"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to History
        </Button>
        {selectedPhase.phase_type === 'common_room' ? (
          <CommonRoom
            gameId={gameId}
            phaseId={selectedPhaseId}
            phaseTitle={selectedPhase.title || getActionPhaseLabel(selectedPhase)}
            phaseDescription={selectedPhase.description}
            isCurrentPhase={false} // Always read-only in history view
            isGM={isGM}
          />
        ) : (
          <div className="surface-base rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-content-primary mb-4">
              {selectedPhase.title || getActionPhaseLabel(selectedPhase)}
            </h3>

            {/* Tab Navigation */}
            <div className="flex border-b border-border-primary mb-6">
              <button
                onClick={() => setActiveTab('submissions')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === 'submissions'
                    ? 'text-interactive-primary border-b-2 border-interactive-primary'
                    : 'text-content-secondary hover:text-content-primary'
                }`}
              >
                Submissions
              </button>
              <button
                onClick={() => setActiveTab('results')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === 'results'
                    ? 'text-interactive-primary border-b-2 border-interactive-primary'
                    : 'text-content-secondary hover:text-content-primary'
                }`}
              >
                Results
              </button>
              <button
                onClick={() => setActiveTab('polls')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === 'polls'
                    ? 'text-interactive-primary border-b-2 border-interactive-primary'
                    : 'text-content-secondary hover:text-content-primary'
                }`}
              >
                Polls
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'submissions' ? (
              // Submissions Tab
              <>
                {isLoadingSubmissions ? (
                  <div className="p-4">
                    <p className="text-content-secondary">Loading action submissions...</p>
                  </div>
                ) : submissionsError ? (
                  <Alert variant="danger">Error loading action submissions</Alert>
                ) : (() => {
                  // Filter submissions for this specific phase
                  const phaseSubmissions = actionSubmissions.filter(s => s.phase_id === selectedPhaseId);

                  if (phaseSubmissions.length === 0) {
                    return (
                      <div className="p-4 surface-raised border border-theme-default rounded">
                        <p className="text-content-secondary">No action submissions for this phase.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {phaseSubmissions.map((submission) => (
                        <div key={submission.id} className="p-4 surface-raised border border-theme-default rounded shadow-sm">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <span className="font-semibold text-content-primary">{submission.character_name}</span>
                              {submission.is_draft && (
                                <span className="inline-block px-2 py-1 text-xs bg-warning-subtle text-warning rounded ml-2">
                                  Draft
                                </span>
                              )}
                            </div>
                            {submission.submitted_at && (
                              <span className="text-xs text-content-tertiary">
                                {new Date(submission.submitted_at).toLocaleString()}
                              </span>
                            )}
                          </div>
                          <div className="prose dark:prose-invert max-w-none">
                            <MarkdownPreview content={submission.content} />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </>
            ) : activeTab === 'results' ? (
              // Results Tab
              <>
                {isLoadingResults ? (
                  <div className="p-4">
                    <p className="text-content-secondary">Loading action results...</p>
                  </div>
                ) : resultsError ? (
                  <Alert variant="danger">Error loading action results</Alert>
                ) : (() => {
                  // Filter results for this specific phase
                  const phaseResults = (actionResults || []).filter(r => r.phase_id === selectedPhaseId);

                  if (phaseResults.length === 0) {
                    return (
                      <div className="p-4 surface-raised border border-theme-default rounded">
                        <p className="text-content-secondary">No action results for this phase.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {phaseResults.map((result) => (
                        <div key={result.id} className="p-4 surface-raised border border-theme-default rounded shadow-sm">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              {!result.is_published && (
                                <span className="inline-block px-2 py-1 text-xs bg-warning-subtle text-warning rounded mr-2">
                                  Draft (Unpublished)
                                </span>
                              )}
                              {result.sent_at && (
                                <span className="text-xs text-content-tertiary">
                                  {new Date(result.sent_at).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="prose dark:prose-invert max-w-none">
                            <MarkdownPreview content={result.content} />
                          </div>
                          {result.gm_username && (
                            <p className="text-xs text-content-tertiary mt-3">From: {result.gm_username}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </>
            ) : (
              // Polls Tab
              <PhaseHistoryPolls gameId={gameId} phaseId={selectedPhaseId} isGM={isGM} />
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="surface-base rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-content-primary mb-2">History</h2>
        <p className="text-content-secondary">
          View Common Room discussions from previous phases
        </p>
      </div>

      {phases.length === 0 ? (
        <div className="text-center py-8 text-content-tertiary">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>No phases yet</p>
          <p className="text-sm">Phases will appear here as they are created</p>
        </div>
      ) : (
        <div className="space-y-3">
          {phases.map((phase) => {
            const phaseLabel = getActionPhaseLabel(phase);
            const phaseColorClass = getActionPhaseColor(phase);
            const isActive = phase.id === currentPhaseId;

            // All phases use the same card layout
            return (
              <Button
                key={phase.id}
                variant="ghost"
                onClick={() => setSelectedPhaseId(phase.id)}
                className={`w-full text-left border rounded-lg p-3 md:p-4 hover:border-theme-subtle ${
                  isActive ? 'border-interactive-primary bg-interactive-primary-subtle' : 'border-theme-default'
                }`}
              >
                {/* Mobile: Vertical Stack Layout */}
                <div className="md:hidden space-y-3">
                  {/* Badge + Active indicator */}
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-1 text-xs rounded-full font-medium border whitespace-nowrap ${phaseColorClass}`}>
                      Phase {phase.phase_number}
                    </span>
                    {isActive && (
                      <span className="px-2 py-1 text-xs bg-interactive-primary-subtle text-interactive-primary rounded-full font-medium whitespace-nowrap">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Title + Description */}
                  <div>
                    <h4 className="font-semibold text-base text-content-primary mb-1">
                      {phase.title || phaseLabel}
                    </h4>
                    {phase.description && (
                      <p className="text-sm text-content-secondary leading-relaxed">{phase.description}</p>
                    )}
                  </div>

                  {/* View arrow */}
                  <div className="flex justify-end">
                    <svg className="w-5 h-5 text-content-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>

                {/* Desktop: Horizontal Layout (Original) */}
                <div className="hidden md:flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 text-xs rounded-full font-medium border whitespace-nowrap ${phaseColorClass}`}>
                      Phase {phase.phase_number}
                    </span>
                    <div>
                      <h4 className="font-medium text-content-primary">{phase.title || phaseLabel}</h4>
                      {phase.description && (
                        <p className="text-sm text-content-secondary mt-1">{phase.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {isActive && (
                      <span className="px-2 py-1 text-xs bg-interactive-primary-subtle text-interactive-primary rounded-full font-medium whitespace-nowrap">
                        Active
                      </span>
                    )}
                    <svg className="w-5 h-5 text-content-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
