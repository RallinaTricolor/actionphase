import type { GamePhase } from '../types/phases';

interface CurrentPhaseCardProps {
  phase: GamePhase;
}

export function CurrentPhaseCard({ phase }: CurrentPhaseCardProps) {
  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-r-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            {phase.phase_type === 'common_room' ? (
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">
                Current Phase: {phase.title || `Phase ${phase.phase_number}`}
              </span>
              <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-blue-100 text-blue-800 border border-blue-200">
                {phase.phase_type === 'common_room' ? 'Discussion' : 'Action'}
              </span>
            </div>
            {phase.deadline && (
              <p className="text-xs text-gray-600 mt-0.5">
                Deadline: {new Date(phase.deadline).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
