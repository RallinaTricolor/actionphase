import React from 'react';
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

  // Styling based on severity
  const severityStyles = {
    [ErrorSeverity.LOW]: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    [ErrorSeverity.MEDIUM]: 'bg-red-50 border-red-200 text-red-700',
    [ErrorSeverity.HIGH]: 'bg-red-100 border-red-300 text-red-800',
    [ErrorSeverity.CRITICAL]: 'bg-red-200 border-red-400 text-red-900',
  };

  const iconStyles = {
    [ErrorSeverity.LOW]: 'text-yellow-500',
    [ErrorSeverity.MEDIUM]: 'text-red-500',
    [ErrorSeverity.HIGH]: 'text-red-600',
    [ErrorSeverity.CRITICAL]: 'text-red-700',
  };

  const baseClasses = `border rounded-md p-4 ${severityStyles[severity]} ${className}`;

  if (compact) {
    return (
      <div className={`${baseClasses} flex items-center justify-between`}>
        <div className="flex items-center">
          <ErrorIcon severity={severity} className={`mr-2 h-4 w-4 ${iconStyles[severity]}`} />
          <span className="text-sm font-medium">{message}</span>
        </div>
        <div className="flex items-center space-x-2">
          {canRetry && onRetry && (
            <button
              onClick={onRetry}
              className="text-sm underline hover:no-underline focus:outline-none"
            >
              Retry
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-sm hover:opacity-75 focus:outline-none"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={baseClasses}>
      <div className="flex">
        <div className="flex-shrink-0">
          <ErrorIcon severity={severity} className={`h-5 w-5 ${iconStyles[severity]}`} />
        </div>

        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium">
            {severity === ErrorSeverity.CRITICAL ? 'Critical Error' : 'Error'}
          </h3>

          <div className="mt-2 text-sm">
            <p>{message}</p>
          </div>

          {recoveryActions.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium">What you can do:</p>
              <ul className="mt-1 text-sm space-y-1">
                {recoveryActions.map((action, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-2">•</span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex space-x-3">
            {canRetry && onRetry && (
              <button
                onClick={onRetry}
                className="bg-white text-sm font-medium rounded-md px-3 py-2 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Try Again
              </button>
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
      </div>
    </div>
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
    <p className={`mt-1 text-sm text-red-600 ${className}`}>
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

  const severityStyles = {
    [ErrorSeverity.LOW]: 'bg-yellow-500',
    [ErrorSeverity.MEDIUM]: 'bg-red-500',
    [ErrorSeverity.HIGH]: 'bg-red-600',
    [ErrorSeverity.CRITICAL]: 'bg-red-700',
  };

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full">
      <div className={`${severityStyles[severity]} text-white p-4 rounded-lg shadow-lg`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <ErrorIcon severity={severity} className="h-5 w-5 mr-2 text-white" />
            <p className="text-sm font-medium">{message}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-2 text-white hover:opacity-75 focus:outline-none"
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
