import { useState } from 'react';
import { PHASE_TYPE_DESCRIPTIONS } from '../types/phases';
import type { CreatePhaseRequest } from '../types/phases';

interface CreatePhaseModalProps {
  onClose: () => void;
  onSubmit: (data: CreatePhaseRequest) => void;
  isSubmitting: boolean;
}

export function CreatePhaseModal({ onClose, onSubmit, isSubmitting }: CreatePhaseModalProps) {
  const [formData, setFormData] = useState<CreatePhaseRequest>({
    phase_type: 'common_room',
    deadline: undefined
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Create New Phase</h3>
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
            <div>
              <label htmlFor="phase-type" className="block text-sm font-medium text-gray-700 mb-2">
                Phase Type
              </label>
              <select
                id="phase-type"
                value={formData.phase_type}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  phase_type: e.target.value as CreatePhaseRequest['phase_type']
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="common_room">Common Room</option>
                <option value="action">Action Phase</option>
              </select>
              <p className="text-sm text-gray-600 mt-1">
                {PHASE_TYPE_DESCRIPTIONS[formData.phase_type]}
              </p>
            </div>

            <div>
              <label htmlFor="phase-title" className="block text-sm font-medium text-gray-700 mb-2">
                Title (Optional)
              </label>
              <input
                id="phase-title"
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  title: e.target.value || undefined
                }))}
                placeholder="e.g., 'The Gathering Storm'"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                Give this phase a custom name
              </p>
            </div>

            <div>
              <label htmlFor="phase-description" className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                id="phase-description"
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  description: e.target.value || undefined
                }))}
                placeholder="Describe what happens in this phase..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="phase-deadline" className="block text-sm font-medium text-gray-700 mb-2">
                Deadline (Optional)
              </label>
              <input
                id="phase-deadline"
                type="datetime-local"
                value={formData.deadline || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  deadline: e.target.value || undefined
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                Set a deadline to create urgency for this phase
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
              {isSubmitting ? 'Creating...' : 'Create Phase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
