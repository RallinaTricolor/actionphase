import { useState } from 'react';
import { PHASE_TYPE_DESCRIPTIONS } from '../types/phases';
import type { CreatePhaseRequest } from '../types/phases';
import { Button, Select, Input, Textarea, DateTimeInput } from './ui';

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
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 h-auto p-0"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <Select
                id="phase-type"
                label="Phase Type"
                value={formData.phase_type}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  phase_type: e.target.value as CreatePhaseRequest['phase_type']
                }))}
                required
                helperText={PHASE_TYPE_DESCRIPTIONS[formData.phase_type]}
              >
                <option value="common_room">Common Room</option>
                <option value="action">Action Phase</option>
              </Select>
            </div>

            <div>
              <Input
                id="phase-title"
                label="Title (Optional)"
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  title: e.target.value || undefined
                }))}
                placeholder="e.g., 'The Gathering Storm'"
                helperText="Give this phase a custom name"
              />
            </div>

            <div>
              <Textarea
                id="phase-description"
                label="Description (Optional)"
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  description: e.target.value || undefined
                }))}
                placeholder="Describe what happens in this phase..."
                rows={3}
              />
            </div>

            <div>
              <DateTimeInput
                id="phase-deadline"
                label="Deadline (Optional)"
                value={formData.deadline || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  deadline: e.target.value || undefined
                }))}
                helperText="Set a deadline to create urgency for this phase"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Phase'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
