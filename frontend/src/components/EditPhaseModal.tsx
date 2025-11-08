import { useState } from 'react';
import { PHASE_TYPE_LABELS, PHASE_TYPE_DESCRIPTIONS } from '../types/phases';
import type { GamePhase, UpdatePhaseRequest } from '../types/phases';
import { Button, Input, Textarea, DateTimeInput } from './ui';
import { Modal } from './Modal';

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
    <Modal isOpen={true} onClose={onClose} title="Edit Phase">
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
            {/* Phase Type (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-content-primary mb-2">
                Phase Type
              </label>
              <div className="px-3 py-2 border border-theme-default rounded-md surface-raised text-content-primary">
                {phaseLabel} (Phase {phase.phase_number})
              </div>
              <p className="text-sm text-content-tertiary mt-1">
                {PHASE_TYPE_DESCRIPTIONS[phase.phase_type]}
              </p>
            </div>

            <div>
              <Input
                id="edit-phase-title"
                label="Title (Optional)"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  title: e.target.value
                }))}
                placeholder="e.g., 'The Gathering Storm'"
                helperText="Give this phase a custom name"
              />
            </div>

            <div>
              <Textarea
                id="edit-phase-description"
                label="Description (Optional)"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  description: e.target.value
                }))}
                placeholder="Describe what happens in this phase..."
                rows={3}
                maxLength={500}
                showCharacterCount
                helperText="Brief description of what happens in this phase (500 char max)"
              />
            </div>

            <div>
              <DateTimeInput
                id="edit-phase-deadline"
                label="Deadline (Optional)"
                value={formData.deadline}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  deadline: e.target.value
                }))}
                helperText="Set or update the deadline for this phase"
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
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
