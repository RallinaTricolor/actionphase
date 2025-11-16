import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test-utils/render';
import { CreatePhaseModal } from './CreatePhaseModal';

describe('CreatePhaseModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnSubmit.mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-11-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('renders the modal with all form fields', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      expect(screen.getByText('Create New Phase')).toBeInTheDocument();
      expect(screen.getByLabelText(/Phase Type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Deadline/i)).toBeInTheDocument();
    });

    it('shows phase type options', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const phaseTypeSelect = screen.getByLabelText(/Phase Type/i);
      expect(phaseTypeSelect).toHaveValue('common_room');

      // Check that both options exist
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
      expect(screen.getByRole('option', { name: 'Common Room' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Action Phase' })).toBeInTheDocument();
    });

    it('displays helper text for phase type', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      // Default is common_room, check for its description
      expect(screen.getByText(/Open discussion period/i)).toBeInTheDocument();
    });
  });

  describe('Form Interaction', () => {
    it('allows changing phase type', async () => {
      const user = userEvent.setup({ delay: null });

      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const phaseTypeSelect = screen.getByLabelText(/Phase Type/i);

      await user.selectOptions(phaseTypeSelect, 'action');

      expect(phaseTypeSelect).toHaveValue('action');

      // Helper text should update
      expect(screen.getByText(/Players submit actions privately/i)).toBeInTheDocument();
    });

    it('allows entering a title', async () => {
      const user = userEvent.setup({ delay: null });

      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const titleInput = screen.getByLabelText(/Title/i);

      await user.type(titleInput, 'The Gathering Storm');

      expect(titleInput).toHaveValue('The Gathering Storm');
    });

    it('allows entering a description', async () => {
      const user = userEvent.setup({ delay: null });

      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const descriptionTextarea = screen.getByLabelText(/Description/i);

      await user.type(descriptionTextarea, 'Dark clouds gather over the city');

      expect(descriptionTextarea).toHaveValue('Dark clouds gather over the city');
    });

    it('allows setting a deadline', async () => {
      const user = userEvent.setup({ delay: null });

      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const deadlineInput = screen.getByLabelText(/Deadline/i);

      await user.type(deadlineInput, '2024-11-20T18:00');

      expect(deadlineInput).toHaveValue('2024-11-20T18:00');
    });
  });

  describe('Form Submission', () => {
    it('calls onSubmit with form data when submitted', async () => {
      const user = userEvent.setup({ delay: null });

      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      // Fill form
      await user.selectOptions(screen.getByLabelText(/Phase Type/i), 'action');
      await user.type(screen.getByLabelText(/Title/i), 'Test Phase');
      await user.type(screen.getByLabelText(/Description/i), 'Test Description');

      // Submit
      const submitButton = screen.getByRole('button', { name: /Create Phase/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });

      const submitData = mockOnSubmit.mock.calls[0][0];
      expect(submitData.phase_type).toBe('action');
      expect(submitData.title).toBe('Test Phase');
      expect(submitData.description).toBe('Test Description');
    });

    it('converts local datetime to UTC when submitting with deadline', async () => {
      const user = userEvent.setup({ delay: null });

      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      // Set a local deadline
      const deadlineInput = screen.getByLabelText(/Deadline/i);
      await user.type(deadlineInput, '2024-11-20T18:00');

      // Submit
      const submitButton = screen.getByRole('button', { name: /Create Phase/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });

      const submitData = mockOnSubmit.mock.calls[0][0];

      // Deadline should be converted to UTC ISO string
      expect(submitData.deadline).toBeDefined();
      expect(submitData.deadline).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Should not be the raw input value
      expect(submitData.deadline).not.toBe('2024-11-20T18:00');
    });

    it('submits without deadline if none is set', async () => {
      const user = userEvent.setup({ delay: null });

      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      // Submit without setting deadline
      const submitButton = screen.getByRole('button', { name: /Create Phase/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });

      const submitData = mockOnSubmit.mock.calls[0][0];
      expect(submitData.deadline).toBeUndefined();
    });

    it('submits without title and description if not provided', async () => {
      const user = userEvent.setup({ delay: null });

      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      // Only select phase type (required)
      await user.selectOptions(screen.getByLabelText(/Phase Type/i), 'common_room');

      // Submit
      const submitButton = screen.getByRole('button', { name: /Create Phase/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });

      const submitData = mockOnSubmit.mock.calls[0][0];
      expect(submitData.phase_type).toBe('common_room');
      expect(submitData.title).toBeUndefined();
      expect(submitData.description).toBeUndefined();
      expect(submitData.deadline).toBeUndefined();
    });

    it('disables submit button when isSubmitting is true', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={true}
        />
      );

      const submitButton = screen.getByRole('button', { name: /Creating.../i });
      expect(submitButton).toBeDisabled();
    });

    it('shows "Creating..." text when submitting', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={true}
        />
      );

      expect(screen.getByText('Creating...')).toBeInTheDocument();
    });
  });

  describe('Cancel Action', () => {
    it('calls onClose when Cancel button is clicked', async () => {
      const user = userEvent.setup({ delay: null });

      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onSubmit when Cancel is clicked', async () => {
      const user = userEvent.setup({ delay: null });

      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Timezone Handling', () => {
    it('properly formats deadline for datetime-local input', async () => {
      const user = userEvent.setup({ delay: null });

      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const deadlineInput = screen.getByLabelText(/Deadline/i) as HTMLInputElement;

      // datetime-local inputs accept YYYY-MM-DDTHH:mm format
      await user.type(deadlineInput, '2024-11-20T14:30');

      expect(deadlineInput.value).toBe('2024-11-20T14:30');

      // Submit and verify conversion
      const submitButton = screen.getByRole('button', { name: /Create Phase/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });

      const submitData = mockOnSubmit.mock.calls[0][0];

      // Submitted deadline should be UTC ISO string
      expect(submitData.deadline).toMatch(/Z$/); // Ends with Z (UTC)
      expect(submitData.deadline).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('handles timezone conversion correctly for round-trip', async () => {
      const user = userEvent.setup({ delay: null });

      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      // User enters a local datetime
      const localDateTime = '2024-12-25T14:00';
      const deadlineInput = screen.getByLabelText(/Deadline/i);
      await user.type(deadlineInput, localDateTime);

      // Submit
      const submitButton = screen.getByRole('button', { name: /Create Phase/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });

      const submitData = mockOnSubmit.mock.calls[0][0];

      // The submitted UTC string should parse correctly
      const submittedDate = new Date(submitData.deadline);
      expect(submittedDate.toString()).not.toBe('Invalid Date');
    });
  });

  describe('Validation', () => {
    it('requires phase_type to be set', async () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      // phase_type select should have required attribute
      const phaseTypeSelect = screen.getByLabelText(/Phase Type/i);
      expect(phaseTypeSelect).toBeRequired();
    });

    it('does not require title field', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const titleInput = screen.getByLabelText(/Title/i);
      expect(titleInput).not.toBeRequired();
    });

    it('does not require description field', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const descriptionTextarea = screen.getByLabelText(/Description/i);
      expect(descriptionTextarea).not.toBeRequired();
    });

    it('does not require deadline field', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const deadlineInput = screen.getByLabelText(/Deadline/i);
      expect(deadlineInput).not.toBeRequired();
    });
  });
});
