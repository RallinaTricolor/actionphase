import { useState } from 'react';
import { Button, Input, Textarea, Select } from './ui';
import type { Handout, UpdateHandoutRequest } from '../types/handouts';
import { Modal } from './Modal';

interface EditHandoutModalProps {
  handout: Handout;
  onClose: () => void;
  onSubmit: (data: UpdateHandoutRequest) => void;
  isSubmitting: boolean;
}

export function EditHandoutModal({ handout, onClose, onSubmit, isSubmitting }: EditHandoutModalProps) {
  const [formData, setFormData] = useState<UpdateHandoutRequest>({
    title: handout.title,
    content: handout.content,
    status: handout.status
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Edit Handout">
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
            <div>
              <Input
                id="handout-title"
                label="Title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  title: e.target.value
                }))}
                placeholder="e.g., 'Combat Rules' or 'World Lore'"
                required
              />
            </div>

            <div>
              <Textarea
                id="handout-content"
                label="Content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  content: e.target.value
                }))}
                placeholder="Write your handout content here... (Markdown supported)"
                rows={10}
                required
                helperText="Supports Markdown formatting"
              />
            </div>

            <div>
              <Select
                id="handout-status"
                label="Status"
                value={formData.status}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  status: e.target.value as 'draft' | 'published'
                }))}
                required
                helperText="Draft handouts are only visible to you. Published handouts are visible to all players."
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </Select>
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
