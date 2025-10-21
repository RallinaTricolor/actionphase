import React from 'react';
import { Alert, Button } from './ui';
import type { AppError } from '../types/errors';
import { ErrorSeverity } from '../types/errors';
import { getErrorMessage, getRecoveryActions, isRecoverable } from '../lib/errors';

interface ErrorDisplayProps {
  error: AppError | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  compact?: boolean;
}

/**
 * Map error severity to Alert variant
 */
const getAlertVariant = (severity: ErrorSeverity): 'warning' | 'danger' => {
  return severity === ErrorSeverity.LOW ? 'warning' : 'danger';
};

/**
 * Reusable component for displaying errors with consistent styling and behavior
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  className = '',
  compact = false,
}) => {
  if (!error) return null;

  const message = getErrorMessage(error);
  const recoveryActions = getRecoveryActions(error);
  const canRetry = isRecoverable(error);
  const severity = error.context?.severity || ErrorSeverity.MEDIUM;
  const variant = getAlertVariant(severity);
  const title = severity === ErrorSeverity.CRITICAL ? 'Critical Error' : 'Error';

  if (compact) {
    return (
      <Alert
        variant={variant}
        dismissible={!!onDismiss}
        onDismiss={onDismiss}
        className={className}
      >
        <div className="flex items-center justify-between w-full">
          <span className="text-sm font-medium">{message}</span>
          {canRetry && onRetry && (
            <button
              onClick={onRetry}
              className="ml-3 text-sm underline hover:no-underline focus:outline-none"
            >
              Retry
            </button>
          )}
        </div>
      </Alert>
    );
  }

  return (
    <Alert
      variant={variant}
      title={title}
      dismissible={false}
      className={className}
    >
      <div className="space-y-3">
        <p className="text-sm">{message}</p>

        {recoveryActions.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-1">What you can do:</p>
            <ul className="text-sm space-y-1 list-disc list-inside">
              {recoveryActions.map((action, index) => (
                <li key={index}>{action}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          {canRetry && onRetry && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onRetry}
            >
              Try Again
            </Button>
          )}

          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-sm font-medium underline hover:no-underline focus:outline-none"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </Alert>
  );
};

/**
 * Inline error component for form fields
 */
export const InlineError: React.FC<{
  error?: string | null;
  className?: string;
}> = ({ error, className = '' }) => {
  if (!error) return null;

  return (
    <p className={`mt-1 text-sm text-semantic-danger ${className}`}>
      {error}
    </p>
  );
};

/**
 * Toast-style error notification
 */
export const ErrorToast: React.FC<{
  error: AppError | null;
  onClose: () => void;
  duration?: number;
}> = ({ error, onClose, duration = 5000 }) => {
  React.useEffect(() => {
    if (error && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [error, onClose, duration]);

  if (!error) return null;

  const message = getErrorMessage(error);
  const severity = error.context?.severity || ErrorSeverity.MEDIUM;

  // Map severity to background color
  const severityStyles = {
    [ErrorSeverity.LOW]: 'bg-semantic-warning',
    [ErrorSeverity.MEDIUM]: 'bg-semantic-danger',
    [ErrorSeverity.HIGH]: 'bg-semantic-danger',
    [ErrorSeverity.CRITICAL]: 'bg-semantic-danger',
  };

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full">
      <div className={`${severityStyles[severity]} text-white p-4 rounded-lg shadow-lg`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center flex-1">
            <ErrorIcon severity={severity} className="h-5 w-5 mr-2 text-white flex-shrink-0" />
            <p className="text-sm font-medium">{message}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-2 text-white hover:opacity-75 focus:outline-none flex-shrink-0"
            aria-label="Close notification"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Error icon component that changes based on severity
 */
const ErrorIcon: React.FC<{
  severity: ErrorSeverity;
  className?: string;
}> = ({ severity, className = '' }) => {
  if (severity === ErrorSeverity.LOW) {
    // Warning icon
    return (
      <svg className={className} fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  // Error/alert icon for medium, high, critical
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
        clipRule="evenodd"
      />
    </svg>
  );
};
