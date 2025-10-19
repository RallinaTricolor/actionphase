import type { UseMutationResult } from '@tanstack/react-query';

interface PhaseActivationDialogProps {
  phaseNumber: number;
  currentPhaseId: number | undefined;
  unpublishedCount: number;
  isActivating: boolean;
  publishAllMutation: UseMutationResult<any, Error, void, unknown>;
  onActivate: () => void;
  onClose: () => void;
}

export function PhaseActivationDialog({
  phaseNumber,
  currentPhaseId,
  unpublishedCount,
  isActivating,
  publishAllMutation,
  onActivate,
  onClose
}: PhaseActivationDialogProps) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Activate Phase {phaseNumber}?
        </h3>

        {currentPhaseId && unpublishedCount > 0 ? (
          <>
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-amber-500 mr-2 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900">
                    You have {unpublishedCount} unpublished {unpublishedCount === 1 ? 'result' : 'results'}
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    Do you want to publish {unpublishedCount === 1 ? 'it' : 'them'} before activating the next phase?
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col space-y-2">
              <button
                onClick={async () => {
                  await publishAllMutation.mutateAsync();
                  onActivate();
                  onClose();
                }}
                disabled={isActivating || publishAllMutation.isPending}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {publishAllMutation.isPending ? 'Publishing...' : isActivating ? 'Activating...' : 'Publish & Activate Phase'}
              </button>
              <button
                onClick={() => {
                  onActivate();
                  onClose();
                }}
                disabled={isActivating || publishAllMutation.isPending}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isActivating ? 'Activating...' : 'Activate Without Publishing'}
              </button>
              <button
                onClick={onClose}
                disabled={isActivating || publishAllMutation.isPending}
                className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-6">
              This will deactivate the current phase and make Phase {phaseNumber} active. Continue?
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                disabled={isActivating}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onActivate();
                  onClose();
                }}
                disabled={isActivating}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isActivating ? 'Activating...' : 'Activate Phase'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
