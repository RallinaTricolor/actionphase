import { useState } from 'react';
import { Button, Input, Textarea, Select } from './ui';
import { MarkdownPreview } from './MarkdownPreview';
import type { CreateHandoutRequest } from '../types/handouts';

interface CreateHandoutModalProps {
  onClose: () => void;
  onSubmit: (data: CreateHandoutRequest) => void;
  isSubmitting: boolean;
}

export function CreateHandoutModal({ onClose, onSubmit, isSubmitting }: CreateHandoutModalProps) {
  const [formData, setFormData] = useState<CreateHandoutRequest>({
    title: '',
    content: '',
    status: 'draft'
  });
  const [showPreview, setShowPreview] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="surface-base rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6" data-testid="handout-form">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-content-primary">Create New Handout</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-content-tertiary hover:text-content-secondary h-auto p-0"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>

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
                data-testid="handout-title-input"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="handout-content" className="block text-sm font-medium text-content-primary">
                  Content <span className="text-danger">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-sm text-interactive-primary hover:text-interactive-primary-hover font-medium transition-colors"
                  data-testid="preview-toggle-button"
                >
                  {showPreview ? 'Edit' : 'Preview'}
                </button>
              </div>

              {showPreview ? (
                <div
                  className="surface-secondary border border-border-primary rounded-lg p-4 min-h-[240px] overflow-y-auto"
                  data-testid="handout-preview"
                >
                  {formData.content ? (
                    <MarkdownPreview content={formData.content} />
                  ) : (
                    <p className="text-content-tertiary italic">No content to preview...</p>
                  )}
                </div>
              ) : (
                <Textarea
                  id="handout-content"
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    content: e.target.value
                  }))}
                  placeholder="Write your handout content here... (Markdown supported)"
                  rows={10}
                  required
                  helperText="Supports Markdown formatting: **bold**, *italic*, # headings, [links](url)"
                  data-testid="handout-content-input"
                />
              )}
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
                data-testid="handout-status-select"
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
              {isSubmitting ? 'Creating...' : 'Create Handout'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
