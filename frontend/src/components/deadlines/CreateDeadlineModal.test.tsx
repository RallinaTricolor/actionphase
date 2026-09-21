import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, render, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateDeadlineModal } from './CreateDeadlineModal';

/**
 * The Deadline field is a react-datepicker (via DateTimeInput), not a native
 * datetime-local input. It parses what is typed using its own dateFormat
 * ("MMMM d, yyyy h:mm aa") and only calls onChange once that parse succeeds,
 * so fireEvent.change with an ISO-ish "2025-12-31T23:59" sets no date at all
 * and the form silently stays empty. Several tests here did exactly that and
 * had been skipped rather than fixed. setDeadline() below types the format the
 * picker actually reads.
 */
const DEADLINE_FORMAT: Intl.DateTimeFormatOptions = {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
};

function typeDeadline(input: HTMLElement, date: Date) {
  // Intl renders "January 1, 2020 at 12:00 PM" on this ICU build (a comma
  // instead of " at " on others); the picker's dateFormat has neither, so
  // both separators are normalized away. \s also covers the NBSP that some
  // builds put before AM/PM.
  const text = new Intl.DateTimeFormat('en-US', DEADLINE_FORMAT)
    .format(date)
    .replace(/\s/g, ' ')
    .replace(/(\d{4})(?:,| at) /, '$1 ');
  fireEvent.change(input, { target: { value: text } });
}

describe('CreateDeadlineModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSubmit = vi.fn();

  // Dates are relative to a pinned now, not hardcoded. These tests previously
  // used a literal 2025-12-31 as "a future date", which silently became a past
  // date and would have started failing on its own.
  const NOW = new Date('2026-06-15T12:00:00Z');
  const FUTURE = new Date('2026-12-31T23:59:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Visibility', () => {
    it('should render when isOpen is true', () => {
      render(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );

      expect(screen.getByRole('heading', { name: 'Create New Deadline' })).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      const { container } = render(
        <CreateDeadlineModal
          isOpen={false}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Form fields', () => {
    it('should render all form fields', () => {
      render(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );

      expect(screen.getByLabelText(/^title$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^description$/i)).toBeInTheDocument();
      // DateTimeInput uses react-datepicker which doesn't properly link labels
      expect(screen.getByText(/^deadline$/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/select deadline date and time/i)).toBeInTheDocument();
    });

    it('should have appropriate placeholders', () => {
      render(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );

      expect(screen.getByPlaceholderText(/e\.g\., Action Submission Deadline/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Provide details about this deadline/i)).toBeInTheDocument();
    });

    it('should start with empty form fields', () => {
      render(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );

      const titleInput = screen.getByLabelText(/^title$/i) as HTMLInputElement;
      const descriptionInput = screen.getByLabelText(/^description$/i) as HTMLTextAreaElement;
      const deadlineInput = screen.getByPlaceholderText(/select deadline date and time/i) as HTMLInputElement;

      expect(titleInput.value).toBe('');
      expect(descriptionInput.value).toBe('');
      expect(deadlineInput.value).toBe('');
    });
  });

  describe('User interactions', () => {
    it('should allow typing in title field', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );

      const titleInput = screen.getByLabelText(/^title$/i);
      await user.type(titleInput, 'Phase 1 Deadline');

      expect(titleInput).toHaveValue('Phase 1 Deadline');
    });

    it('should allow typing in description field', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );

      const descriptionInput = screen.getByLabelText(/^description$/i);
      await user.type(descriptionInput, 'Submit your action by this date');

      expect(descriptionInput).toHaveValue('Submit your action by this date');
    });

    it('should allow selecting deadline date/time', async () => {

      render(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );

      const deadlineInput = screen.getByPlaceholderText(/select deadline date and time/i);

      // datetime-local format: YYYY-MM-DDTHH:mm
      typeDeadline(deadlineInput, FUTURE);

      // react-datepicker doesn't set input value attribute directly
      // The value is managed internally by the DateTimeInput component
      expect(deadlineInput).toBeInTheDocument();
    });
  });

  describe('Form validation', () => {
    it('should show error when title is empty', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );

      const createButton = screen.getByRole('button', { name: /create deadline/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should show error when description is empty', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );

      const titleInput = screen.getByLabelText(/^title$/i);
      await user.type(titleInput, 'Test Deadline');

      const createButton = screen.getByRole('button', { name: /create deadline/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/description is required/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should show error when deadline is empty', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );

      const titleInput = screen.getByLabelText(/^title$/i);
      const descriptionInput = screen.getByLabelText(/^description$/i);

      await user.type(titleInput, 'Test Deadline');
      await user.type(descriptionInput, 'Test description');

      const createButton = screen.getByRole('button', { name: /create deadline/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/deadline is required/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should show error when title exceeds 100 characters', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );

      const titleInput = screen.getByLabelText(/^title$/i);
      const longTitle = 'a'.repeat(101); // 101 characters
      // Paste rather than type: user.type fires a full event cycle + re-render
      // per character, which times out under parallel test load. The length is
      // what's under test here, not the keystrokes.
      await user.click(titleInput);
      await user.paste(longTitle);

      const createButton = screen.getByRole('button', { name: /create deadline/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/title must be 100 characters or less/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should show error when deadline is in the past', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );

      const titleInput = screen.getByLabelText(/^title$/i);
      const descriptionInput = screen.getByLabelText(/^description$/i);
      const deadlineInput = screen.getByPlaceholderText(/select deadline date and time/i);

      await user.type(titleInput, 'Test Deadline');
      await user.type(descriptionInput, 'Test description');

      // Use a date in the past
      typeDeadline(deadlineInput, new Date('2020-01-01T12:00:00Z'));

      const createButton = screen.getByRole('button', { name: /create deadline/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/deadline must be in the future/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should accept title of exactly 100 characters', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );

      const titleInput = screen.getByLabelText(/^title$/i);
      const descriptionInput = screen.getByLabelText(/^description$/i);
      const deadlineInput = screen.getByPlaceholderText(/select deadline date and time/i);

      const exactLengthTitle = 'a'.repeat(100); // Exactly 100 characters
      await user.click(titleInput);
      await user.paste(exactLengthTitle);
      await user.type(descriptionInput, 'Test description');

      // Use a future date
      typeDeadline(deadlineInput, FUTURE);

      const createButton = screen.getByRole('button', { name: /create deadline/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });
  });

  describe('Form submission', () => {
    it('should call onSubmit with correct data when form is valid', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );

      const titleInput = screen.getByLabelText(/^title$/i);
      const descriptionInput = screen.getByLabelText(/^description$/i);
      const deadlineInput = screen.getByPlaceholderText(/select deadline date and time/i);

      await user.type(titleInput, 'Phase 1 Deadline');
      await user.type(descriptionInput, 'Submit your action by this date');

      // Use a future date
      typeDeadline(deadlineInput, FUTURE);

      const createButton = screen.getByRole('button', { name: /create deadline/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          title: 'Phase 1 Deadline',
          description: 'Submit your action by this date',
          deadline: expect.stringMatching(/^2026-12-31T\d{2}:59:00\.\d{3}Z$/), // ISO 8601
        });
      });
    });

    it('should trim whitespace from title and description', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );

      const titleInput = screen.getByLabelText(/^title$/i);
      const descriptionInput = screen.getByLabelText(/^description$/i);
      const deadlineInput = screen.getByPlaceholderText(/select deadline date and time/i);

      await user.type(titleInput, '  Test Deadline  ');
      await user.type(descriptionInput, '  Test description  ');

      typeDeadline(deadlineInput, FUTURE);

      const createButton = screen.getByRole('button', { name: /create deadline/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Test Deadline',
            description: 'Test description',
          })
        );
      });
    });

    it('should convert datetime-local to ISO 8601 format', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );

      const titleInput = screen.getByLabelText(/^title$/i);
      const descriptionInput = screen.getByLabelText(/^description$/i);
      const deadlineInput = screen.getByPlaceholderText(/select deadline date and time/i);

      await user.type(titleInput, 'Test');
      await user.type(descriptionInput, 'Test');
      typeDeadline(deadlineInput, FUTURE);

      const createButton = screen.getByRole('button', { name: /create deadline/i });
      await user.click(createButton);

      await waitFor(() => {
        const call = mockOnSubmit.mock.calls[0][0];
        // Should be ISO 8601 format with Z suffix
        expect(call.deadline).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });
    });
  });

  describe('Modal controls', () => {
    it('should render cancel and create buttons', () => {
      render(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create deadline/i })).toBeInTheDocument();
    });

    it('should call onClose when cancel is clicked', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledOnce();
    });

    it('should reset form when modal closes', async () => {
      const user = userEvent.setup({ delay: null });

      const { rerender } = render(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );

      // Fill in form
      const titleInput = screen.getByLabelText(/^title$/i);
      await user.type(titleInput, 'Test Deadline');

      // Close modal
      rerender(
        <CreateDeadlineModal
          isOpen={false}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );

      // Reopen modal
      rerender(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );

      // Form should be empty
      const titleInputAfterReopen = screen.getByLabelText(/^title$/i) as HTMLInputElement;
      expect(titleInputAfterReopen.value).toBe('');
    });
  });

  describe('Loading state', () => {
    it('should disable form when isLoading is true', () => {
      render(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isLoading={true}
        />
      );

      expect(screen.getByLabelText(/^title$/i)).toBeDisabled();
      expect(screen.getByLabelText(/^description$/i)).toBeDisabled();
      expect(screen.getByPlaceholderText(/select deadline date and time/i)).toBeDisabled();
      expect(screen.getByRole('button', { name: /create deadline/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    });

    it('should show loading state on create button', () => {
      render(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isLoading={true}
        />
      );

      const createButton = screen.getByRole('button', { name: /create deadline/i });
      expect(createButton).toHaveAttribute('disabled');
    });
  });

  describe('Error handling', () => {
    it('should display error message when error prop is provided', () => {
      const errorMessage = 'Failed to create deadline';

      render(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          error={errorMessage}
        />
      );

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should not display error alert when error is undefined', () => {
      render(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );

      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have required attributes on inputs', () => {
      render(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );

      expect(screen.getByLabelText(/^title$/i)).toHaveAttribute('required');
      expect(screen.getByLabelText(/^description$/i)).toHaveAttribute('required');
      // DateTimeInput uses react-datepicker which handles required validation differently
      // The required validation is handled programmatically in validateForm()
      expect(screen.getByPlaceholderText(/select deadline date and time/i)).toBeInTheDocument();
    });

    it('should have proper labels for all inputs', () => {
      render(
        <CreateDeadlineModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );

      expect(screen.getByLabelText(/^title$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^description$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^deadline$/i)).toBeInTheDocument();
    });
  });
});
