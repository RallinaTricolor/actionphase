import { useState, useEffect } from 'react';
import { Modal, Input, Textarea, DateTimeInput, Button, Alert } from './ui';
import type { UnifiedDeadline, UpdateDeadlineRequest } from '../types/deadlines';

export interface EditDeadlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (deadlineId: number, data: UpdateDeadlineRequest) => void;
  deadline: UnifiedDeadline | null;
  isLoading?: boolean;
  error?: string;
}

/**
 * EditDeadlineModal - Modal for editing existing deadlines
 *
 * Features:
 * - Pre-filled form with deadline data
 * - Form validation
 * - Date/time picker
 * - Error display
 * - Loading state
 *
 * @example
 * ```tsx
 * <EditDeadlineModal
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   onSubmit={handleUpdate}
 *   deadline={selectedDeadline}
 *   isLoading={updateMutation.isPending}
 *   error={updateMutation.error?.message}
 * />
 * ```
 */
export function EditDeadlineModal({
  isOpen,
  onClose,
  onSubmit,
  deadline,
  isLoading = false,
  error,
}: EditDeadlineModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadlineValue, setDeadlineValue] = useState('');
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  // Populate form when deadline changes
  useEffect(() => {
    if (deadline) {
      setTitle(deadline.title || '');
      setDescription(deadline.description || '');

      // Convert ISO deadline to datetime-local format if it exists
      if (deadline.deadline) {
        const date = new Date(deadline.deadline);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        setDeadlineValue(`${year}-${month}-${day}T${hours}:${minutes}`);
      } else {
        setDeadlineValue('');
      }
    }
  }, [deadline]);

  const handleClose = () => {
    // Reset validation errors on close
    setValidationErrors({});
    onClose();
  };

  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};

    if (!title.trim()) {
      errors.title = 'Title is required';
    } else if (title.trim().length > 200) {
      errors.title = 'Title must be 200 characters or less';
    }

    if (!description.trim()) {
      errors.description = 'Description is required';
    }

    if (!deadlineValue) {
      errors.deadline = 'Deadline is required';
    } else {
      // Validate deadline is in the future
      const deadlineDate = new Date(deadlineValue);
      if (deadlineDate <= new Date()) {
        errors.deadline = 'Deadline must be in the future';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!deadline) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    // Convert local datetime to ISO 8601 format for backend
    const deadlineDate = new Date(deadlineValue);
    const isoDeadline = deadlineDate.toISOString();

    onSubmit(deadline.source_id, {
      title: title.trim(),
      description: description.trim(),
      deadline: isoDeadline,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Edit Deadline"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={isLoading}
            disabled={isLoading || !deadline}
          >
            Save Changes
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="danger" title="Error">
            {error}
          </Alert>
        )}

        <Input
          name="title"
          label="Title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={validationErrors.title}
          placeholder="e.g., Action Submission Deadline"
          disabled={isLoading}
          required
        />

        <Textarea
          name="description"
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={validationErrors.description}
          placeholder="Provide details about this deadline..."
          rows={4}
          disabled={isLoading}
          required
        />

        <DateTimeInput
          name="deadline"
          label="Deadline"
          value={deadlineValue}
          onChange={(e) => setDeadlineValue(e.target.value)}
          error={validationErrors.deadline}
          placeholder="Select deadline date and time"
          disabled={isLoading}
          required
        />
      </form>
    </Modal>
  );
}
