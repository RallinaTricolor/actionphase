import { useCallback, useState } from 'react';
import { AppError } from '../types/errors';
import {
  createAppError,
  getErrorMessage,
  isRecoverable,
  shouldDisplayError,
  logError
} from '../lib/errors';

interface UseErrorHandlerOptions {
  onError?: (error: AppError) => void;
  autoDisplay?: boolean;
  autoLog?: boolean;
}

interface UseErrorHandlerReturn {
  error: AppError | null;
  hasError: boolean;
  isRecoverable: boolean;
  errorMessage: string;
  handleError: (error: unknown) => void;
  clearError: () => void;
  retryAction?: () => void;
}

/**
 * Hook for standardized error handling in React components
 */
export function useErrorHandler(options: UseErrorHandlerOptions = {}): UseErrorHandlerReturn {
  const { onError, autoDisplay = true, autoLog = true } = options;

  const [error, setError] = useState<AppError | null>(null);

  const handleError = useCallback((rawError: unknown) => {
    const appError = createAppError(rawError);

    if (autoLog) {
      logError(appError);
    }

    if (shouldDisplayError(appError) && autoDisplay) {
      setError(appError);
    }

    onError?.(appError);
  }, [onError, autoDisplay, autoLog]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    hasError: error !== null,
    isRecoverable: error ? isRecoverable(error) : false,
    errorMessage: error ? getErrorMessage(error) : '',
    handleError,
    clearError,
  };
}

/**
 * Hook for handling async operations with built-in error handling
 */
export function useAsyncError<T = unknown>(options: UseErrorHandlerOptions = {}) {
  const errorHandler = useErrorHandler(options);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(async (asyncFn: () => Promise<T>) => {
    try {
      setLoading(true);
      errorHandler.clearError();
      const result = await asyncFn();
      setData(result);
      return result;
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [errorHandler]);

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    errorHandler.clearError();
  }, [errorHandler]);

  return {
    ...errorHandler,
    loading,
    data,
    execute,
    reset,
  };
}

/**
 * Hook for form error handling with field-specific errors
 */
export function useFormErrors() {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string>('');

  const setFieldError = useCallback((field: string, error: string) => {
    setFieldErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors(prev => {
      const { [field]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const setError = useCallback((error: unknown) => {
    const appError = createAppError(error);
    const message = getErrorMessage(appError);

    // If error has field context, set field error
    if (appError.context?.metadata?.field) {
      setFieldError(appError.context.metadata.field as string, message);
    } else {
      setGeneralError(message);
    }
  }, [setFieldError]);

  const clearAllErrors = useCallback(() => {
    setFieldErrors({});
    setGeneralError('');
  }, []);

  const hasErrors = Object.keys(fieldErrors).length > 0 || generalError !== '';

  return {
    fieldErrors,
    generalError,
    hasErrors,
    setFieldError,
    clearFieldError,
    setError,
    clearAllErrors,
  };
}
