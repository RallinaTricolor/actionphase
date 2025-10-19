import { useState } from 'react';
import { PHASE_TYPE_LABELS, PHASE_TYPE_DESCRIPTIONS } from '../types/phases';
import type { GamePhase, UpdatePhaseRequest } from '../types/phases';

interface EditPhaseModalProps {
  phase: GamePhase;
  onClose: () => void;
  onSubmit: (data: UpdatePhaseRequest) => void;
  isSubmitting: boolean;
}

export function EditPhaseModal({ phase, onClose, onSubmit, isSubmitting }: EditPhaseModalProps) {
  const [formData, setFormData] = useState<UpdatePhaseRequest>({
    title: phase.title || '',
    description: phase.description || '',
    deadline: phase.deadline ? new Date(phase.deadline).toISOString().slice(0, 16) : ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title: formData.title || undefined,
      description: formData.description || undefined,
      deadline: formData.deadline || undefined
    });
  };

  const phaseLabel = PHASE_TYPE_LABELS[phase.phase_type];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Edit Phase</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Phase Type (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phase Type
              </label>
              <div className="px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-700">
                {phaseLabel} (Phase {phase.phase_number})
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {PHASE_TYPE_DESCRIPTIONS[phase.phase_type]}
              </p>
            </div>

            <div>
              <label htmlFor="edit-phase-title" className="block text-sm font-medium text-gray-700 mb-2">
                Title (Optional)
              </label>
              <input
                id="edit-phase-title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  title: e.target.value
                }))}
                placeholder="e.g., 'The Gathering Storm'"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                Give this phase a custom name
              </p>
            </div>

            <div>
              <label htmlFor="edit-phase-description" className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                id="edit-phase-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  description: e.target.value
                }))}
                placeholder="Describe what happens in this phase..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="edit-phase-deadline" className="block text-sm font-medium text-gray-700 mb-2">
                Deadline (Optional)
              </label>
              <input
                id="edit-phase-deadline"
                type="datetime-local"
                value={formData.deadline}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  deadline: e.target.value
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                Set or update the deadline for this phase
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
