import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, render } from '@testing-library/react'
import { ErrorDisplay, InlineError, ErrorToast } from '../ErrorDisplay'
import { ErrorCategory, ErrorSeverity, ErrorType } from '../../types/errors'
import type { AppError, ErrorContext } from '../../types/errors'

// Mock the error utility functions
vi.mock('../../lib/errors', () => ({
  getErrorMessage: vi.fn((error: AppError) => error.message),
  getRecoveryActions: vi.fn((error: AppError) => error.context?.recoveryActions || []),
  isRecoverable: vi.fn((error: AppError) => error.context?.category === 'recoverable'),
  ErrorSeverity: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
  },
}))

import { getRecoveryActions, isRecoverable } from '../../lib/errors'

/**
 * Builds a complete AppError. AppError extends Error, so the object must be a
 * real Error instance -- a bare literal is not assignable. ErrorContext
 * requires type/category/severity/userMessage/timestamp; tests override only
 * the field under test.
 */
function makeAppError(
  message: string,
  context: Partial<ErrorContext> = {},
): AppError {
  return Object.assign(new Error(message), {
    type: ErrorType.UNKNOWN_ERROR,
    context: {
      type: ErrorType.UNKNOWN_ERROR,
      category: ErrorCategory.RECOVERABLE,
      severity: ErrorSeverity.MEDIUM,
      userMessage: message,
      timestamp: new Date(),
      ...context,
    },
  })
}

describe('ErrorDisplay', () => {
  const mockOnRetry = vi.fn()
  const mockOnDismiss = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when error is null', () => {
    const { container } = render(<ErrorDisplay error={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('displays error message', () => {
    const error = makeAppError('Something went wrong')

    render(<ErrorDisplay error={error} />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  describe('Severity Levels', () => {
    it('renders LOW severity with warning styling', () => {
      const error = makeAppError('Warning message', { severity: ErrorSeverity.LOW })

      render(<ErrorDisplay error={error} />)

      // Alert component handles styling internally via variant prop
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Warning message')).toBeInTheDocument()
    })

    it('renders MEDIUM severity with error styling', () => {
      const error = makeAppError('Error message', { severity: ErrorSeverity.MEDIUM })

      render(<ErrorDisplay error={error} />)

      // Alert component handles styling internally via variant prop
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Error message')).toBeInTheDocument()
    })

    it('renders HIGH severity with stronger error styling', () => {
      const error = makeAppError('High priority error', { severity: ErrorSeverity.HIGH })

      render(<ErrorDisplay error={error} />)

      // Alert component handles styling internally via variant prop
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('High priority error')).toBeInTheDocument()
    })

    it('renders CRITICAL severity with strongest error styling', () => {
      const error = makeAppError('Critical error', { severity: ErrorSeverity.CRITICAL })

      render(<ErrorDisplay error={error} />)

      expect(screen.getByText('Critical Error')).toBeInTheDocument()
      // Alert component handles styling internally via variant prop
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Critical error')).toBeInTheDocument()
    })

    it('defaults to MEDIUM severity when not specified', () => {
      const error = makeAppError('Default severity')

      render(<ErrorDisplay error={error} />)

      // Alert component handles styling internally via variant prop
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Default severity')).toBeInTheDocument()
    })
  })

  describe('Compact Mode', () => {
    it('renders in compact mode with simplified layout', () => {
      const error = makeAppError('Compact error')

      render(<ErrorDisplay error={error} compact={true} />)

      const message = screen.getByText('Compact error')
      expect(message).toHaveClass('text-sm', 'font-medium')
    })

    it('shows retry button in compact mode when recoverable', () => {
      const error = makeAppError('Recoverable error', { category: 'recoverable' })

      render(<ErrorDisplay error={error} compact={true} onRetry={mockOnRetry} />)

      const retryButton = screen.getByRole('button', { name: 'Retry' })
      expect(retryButton).toBeInTheDocument()

      fireEvent.click(retryButton)
      expect(mockOnRetry).toHaveBeenCalledOnce()
    })

    it('shows dismiss button in compact mode', () => {
      const error = makeAppError('Dismissable error')

      render(<ErrorDisplay error={error} compact={true} onDismiss={mockOnDismiss} />)

      const dismissButton = screen.getByRole('button', { name: 'Dismiss' })
      expect(dismissButton).toBeInTheDocument()

      fireEvent.click(dismissButton)
      expect(mockOnDismiss).toHaveBeenCalledOnce()
    })
  })

  describe('Full Mode', () => {
    it('displays recovery actions when available', () => {
      const error = makeAppError('Error with recovery', { recoveryActions: ['Try refreshing the page', 'Check your internet connection', 'Contact support'] })

      vi.mocked(getRecoveryActions).mockReturnValue(error.context!.recoveryActions!)

      render(<ErrorDisplay error={error} />)

      expect(screen.getByText('What you can do:')).toBeInTheDocument()
      expect(screen.getByText('Try refreshing the page')).toBeInTheDocument()
      expect(screen.getByText('Check your internet connection')).toBeInTheDocument()
      expect(screen.getByText('Contact support')).toBeInTheDocument()
    })

    it('shows "Try Again" button in full mode when recoverable', () => {
      const error = makeAppError('Recoverable error', { category: 'recoverable' })

      render(<ErrorDisplay error={error} onRetry={mockOnRetry} />)

      const retryButton = screen.getByRole('button', { name: 'Try Again' })
      expect(retryButton).toBeInTheDocument()

      fireEvent.click(retryButton)
      expect(mockOnRetry).toHaveBeenCalledOnce()
    })

    it('shows "Dismiss" button in full mode', () => {
      const error = makeAppError('Dismissable error')

      render(<ErrorDisplay error={error} onDismiss={mockOnDismiss} />)

      const dismissButton = screen.getByRole('button', { name: 'Dismiss' })
      expect(dismissButton).toBeInTheDocument()

      fireEvent.click(dismissButton)
      expect(mockOnDismiss).toHaveBeenCalledOnce()
    })

    it('hides retry button when error is not recoverable', () => {
      const error = makeAppError('Non-recoverable error', { category: 'non_recoverable' })

      vi.mocked(isRecoverable).mockReturnValue(false)

      render(<ErrorDisplay error={error} onRetry={mockOnRetry} />)

      expect(screen.queryByRole('button', { name: 'Try Again' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    })

    it('hides buttons when callbacks are not provided', () => {
      const error = makeAppError('No callbacks')

      render(<ErrorDisplay error={error} />)

      expect(screen.queryByRole('button', { name: 'Try Again' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument()
    })
  })

  describe('Custom Styling', () => {
    it('applies custom className', () => {
      const error = makeAppError('Custom class error')

      render(<ErrorDisplay error={error} className="my-custom-class" />)

      // Alert component handles styling internally via variant prop
    })
  })
})

describe('InlineError', () => {
  it('renders nothing when error is null', () => {
    const { container } = render(<InlineError error={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when error is undefined', () => {
    const { container } = render(<InlineError />)
    expect(container).toBeEmptyDOMElement()
  })

  it('displays error message', () => {
    render(<InlineError error="This field is required" />)
    expect(screen.getByText('This field is required')).toBeInTheDocument()
  })

  it('applies correct styling', () => {
    render(<InlineError error="Validation error" />)
    const error = screen.getByText('Validation error')
    expect(error).toHaveClass('mt-1', 'text-sm', 'text-semantic-danger')
  })

  it('applies custom className', () => {
    render(<InlineError error="Custom error" className="my-custom-class" />)
    const error = screen.getByText('Custom error')
    expect(error).toHaveClass('my-custom-class')
  })
})

describe('ErrorToast', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders nothing when error is null', () => {
    const { container } = render(<ErrorToast error={null} onClose={mockOnClose} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('displays error message in toast', () => {
    const error = makeAppError('Toast message')

    render(<ErrorToast error={error} onClose={mockOnClose} />)

    expect(screen.getByText('Toast message')).toBeInTheDocument()
  })

  it('automatically closes after default duration (5 seconds)', () => {
    const error = makeAppError('Auto close toast')

    render(<ErrorToast error={error} onClose={mockOnClose} />)

    expect(mockOnClose).not.toHaveBeenCalled()

    vi.advanceTimersByTime(5000)

    expect(mockOnClose).toHaveBeenCalledOnce()
  })

  it('automatically closes after custom duration', () => {
    const error = makeAppError('Custom duration toast')

    render(<ErrorToast error={error} onClose={mockOnClose} duration={3000} />)

    vi.advanceTimersByTime(3000)

    expect(mockOnClose).toHaveBeenCalledOnce()
  })

  it('does not auto-close when duration is 0', () => {
    const error = makeAppError('No auto-close toast')

    render(<ErrorToast error={error} onClose={mockOnClose} duration={0} />)

    vi.advanceTimersByTime(10000)

    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('allows manual close via button', () => {
    const error = makeAppError('Manual close toast')

    render(<ErrorToast error={error} onClose={mockOnClose} />)

    const closeButton = screen.getByRole('button', { name: 'Close notification' })
    fireEvent.click(closeButton)

    expect(mockOnClose).toHaveBeenCalledOnce()
  })

  it('applies LOW severity styling', () => {
    const error = makeAppError('Low severity toast', { severity: ErrorSeverity.LOW })

    const { container } = render(<ErrorToast error={error} onClose={mockOnClose} />)

    const toastContainer = container.querySelector('.bg-semantic-warning')
    expect(toastContainer).toBeInTheDocument()
  })

  it('applies CRITICAL severity styling', () => {
    const error = makeAppError('Critical toast', { severity: ErrorSeverity.CRITICAL })

    const { container } = render(<ErrorToast error={error} onClose={mockOnClose} />)

    const toastContainer = container.querySelector('.bg-semantic-danger')
    expect(toastContainer).toBeInTheDocument()
  })

  it('is positioned at top-right', () => {
    const error = makeAppError('Positioned toast')

    render(<ErrorToast error={error} onClose={mockOnClose} />)

    const outerContainer = screen.getByText('Positioned toast').closest('.fixed')
    expect(outerContainer).toHaveClass('fixed', 'top-4', 'right-4', 'z-50')
  })
})
