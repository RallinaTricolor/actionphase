# Frontend Error Handling Guide for ActionPhase

This document outlines the comprehensive error handling system implemented in the ActionPhase React frontend, designed to provide consistent, user-friendly error experiences while maintaining developer productivity.

## Overview

The frontend error handling system provides:

- **Standardized error types** that align with backend API responses
- **React Error Boundaries** for catching component errors
- **Consistent UI components** for displaying errors
- **Hooks for simplified error handling** in components
- **Automatic error classification** and recovery suggestions

## Architecture

### Error Types and Classification

#### Core Error Interface
```typescript
interface AppError extends Error {
  type: ErrorType;
  statusCode?: number;
  apiError?: ApiError;
  context?: Record<string, unknown>;
}
```

#### Error Categories
- **RECOVERABLE**: User can retry or take action
- **NON_RECOVERABLE**: Requires page reload or navigation
- **SILENT**: Log but don't display to user

#### Error Severity Levels
- **LOW**: Minor issues, app continues normally
- **MEDIUM**: Some functionality affected
- **HIGH**: Major functionality broken
- **CRITICAL**: App unusable

### Error Sources and Handling

#### 1. API/Network Errors
Handled by `createAppError()` function which processes Axios errors:

```typescript
// Backend API error structure (matches backend ErrResponse)
interface ApiError {
  status: string;    // "Bad request.", "Unauthorized.", etc.
  code?: number;     // Application error code
  error?: string;    // Detailed error message
}

// Automatic HTTP status code mapping
const STATUS_CODE_TO_ERROR_TYPE = {
  400: ErrorType.VALIDATION_ERROR,
  401: ErrorType.AUTHENTICATION_ERROR,
  403: ErrorType.AUTHORIZATION_ERROR,
  // ...
};
```

#### 2. Component Errors
Caught by Error Boundaries and classified as `COMPONENT_ERROR`:

```typescript
<ErrorBoundary fallback={CustomErrorFallback}>
  <YourComponent />
</ErrorBoundary>
```

#### 3. Validation Errors
Client-side validation failures:

```typescript
const { setFieldError } = useFormErrors();
setFieldError('username', 'Username is required');
```

## Error Handling Components

### 1. ErrorBoundary
Catches React component errors and displays fallback UI:

```typescript
// Basic usage
<ErrorBoundary>
  <App />
</ErrorBoundary>

// With custom fallback
<ErrorBoundary fallback={CustomErrorFallback}>
  <Component />
</ErrorBoundary>

// Specialized boundaries
<FormErrorBoundary onFieldError={handleFieldError}>
  <Form />
</FormErrorBoundary>
```

### 2. ErrorDisplay Component
Reusable component for displaying errors with consistent styling:

```typescript
<ErrorDisplay
  error={error}
  onRetry={handleRetry}
  onDismiss={clearError}
  compact={true}
/>

// Inline form errors
<InlineError error={fieldError} />

// Toast notifications
<ErrorToast
  error={error}
  onClose={clearError}
  duration={5000}
/>
```

### 3. Error Handling Hooks

#### useErrorHandler
Basic error handling for components:

```typescript
const { error, handleError, clearError, isRecoverable } = useErrorHandler({
  autoDisplay: true,
  autoLog: true,
});

try {
  await someAsyncOperation();
} catch (err) {
  handleError(err);
}
```

#### useAsyncError
Handles async operations with built-in loading and error states:

```typescript
const { execute, loading, error, data } = useAsyncError();

const loadData = async () => {
  return execute(() => apiClient.getData());
};
```

#### useFormErrors
Manages form validation and submission errors:

```typescript
const {
  fieldErrors,
  generalError,
  setFieldError,
  setError,
  clearAllErrors
} = useFormErrors();
```

## Error Handling Patterns

### 1. API Call Error Handling

```typescript
// In components
const { handleError } = useErrorHandler();

const handleLogin = async (formData: LoginRequest) => {
  try {
    await login(formData);
    navigate('/dashboard');
  } catch (err) {
    // Uses specialized error handler for authentication
    handleError(errorHandlers.authentication(err));
  }
};
```

### 2. Form Validation Errors

```typescript
const LoginForm = () => {
  const { fieldErrors, setFieldError, setError } = useFormErrors();

  const validateForm = (data: FormData) => {
    if (!data.username) {
      setFieldError('username', 'Username is required');
      return false;
    }
    // ... other validations
    return true;
  };

  return (
    <form>
      <input name="username" />
      <InlineError error={fieldErrors.username} />
      {/* ... */}
    </form>
  );
};
```

### 3. Component Error Recovery

```typescript
const DataList = () => {
  const { data, error, loading, execute } = useAsyncError();

  useEffect(() => {
    execute(() => apiClient.fetchData());
  }, []);

  if (error) {
    return (
      <ErrorDisplay
        error={error}
        onRetry={() => execute(() => apiClient.fetchData())}
      />
    );
  }

  // ... render data
};
```

## Error Message Standards

### User-Facing Messages
- Clear and actionable
- No technical jargon
- Consistent with backend error messages
- Provide recovery suggestions when possible

```typescript
export const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid username or password',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  NETWORK_UNAVAILABLE: 'Unable to connect to server. Please check your connection.',
  GAME_FULL: 'This game is full and not accepting new players',
  // ...
} as const;
```

### Error Context Enhancement
```typescript
const error = createAppError(rawError, {
  type: ErrorType.GAME_STATE_ERROR,
  severity: ErrorSeverity.MEDIUM,
  userMessage: 'Cannot join this game right now',
  recoveryActions: ['Check game status', 'Try again later'],
});
```

## Integration with Backend

### Matching Backend Error Structure
Frontend error types align with backend `ErrResponse` structure:

```typescript
// Backend response
{
  "status": "Bad request.",
  "code": 1001,
  "error": "username already exists"
}

// Frontend processing
const appError = createAppError(axiosError);
// Automatically extracts user message from backend response
```

### Error Code Handling
```typescript
// Custom error codes from backend
export const ERROR_CODES = {
  DUPLICATE_USERNAME: 1001,
  GAME_NOT_FOUND: 2001,
  GAME_FULL: 2002,
  // ...
} as const;

// Usage in error handler
if (apiError.code === ERROR_CODES.GAME_FULL) {
  // Show specific UI for full games
}
```

## Testing Error Handling

### Error Boundary Testing
```typescript
// Test error boundary fallback
it('displays error fallback when component throws', () => {
  const ThrowError = () => {
    throw new Error('Test error');
  };

  render(
    <ErrorBoundary>
      <ThrowError />
    </ErrorBoundary>
  );

  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
});
```

### Hook Testing
```typescript
// Test error handling hook
it('handles errors correctly', async () => {
  const { result } = renderHook(() => useErrorHandler());

  const testError = new Error('Test error');
  act(() => {
    result.current.handleError(testError);
  });

  expect(result.current.hasError).toBe(true);
  expect(result.current.error).toBeTruthy();
});
```

### Component Error Testing
```typescript
// Test error display component
it('displays error with retry button', () => {
  const mockRetry = vi.fn();
  const error = createAppError(new Error('Test error'));

  render(<ErrorDisplay error={error} onRetry={mockRetry} />);

  expect(screen.getByText(/test error/i)).toBeInTheDocument();

  const retryButton = screen.getByText(/try again/i);
  fireEvent.click(retryButton);
  expect(mockRetry).toHaveBeenCalled();
});
```

## Performance Considerations

### Error Boundary Optimization
- Error boundaries only re-render on errors
- Use specialized boundaries for specific error types
- Implement error recovery without full page reloads

### Memory Management
- Clear errors when components unmount
- Avoid storing large error objects in state
- Use error IDs for debugging without retaining full error objects

## Best Practices

### 1. Error Classification
```typescript
// Always classify errors appropriately
const error = createAppError(rawError, {
  type: ErrorType.VALIDATION_ERROR,  // Specific type
  category: ErrorCategory.RECOVERABLE,  // User can fix
  severity: ErrorSeverity.LOW,       // Minor issue
});
```

### 2. Recovery Actions
```typescript
// Provide actionable recovery suggestions
const recoveryActions = getRecoveryActions(error);
// ['Check your input and try again', 'Contact support if problem persists']
```

### 3. Contextual Error Handling
```typescript
// Use appropriate error handlers for context
handleError(errorHandlers.authentication(err));  // Login/auth
handleError(errorHandlers.validation(err));      // Form validation
handleError(errorHandlers.gameState(err));       // Game-specific errors
```

### 4. Graceful Degradation
```typescript
// Provide fallback UI for non-critical errors
if (error && error.severity !== ErrorSeverity.CRITICAL) {
  return <PartialUI error={error} />;
}
```

## Migration Guide

### Updating Existing Components

1. **Replace ad-hoc error handling**:
```typescript
// Before
const [error, setError] = useState(null);
try {
  await apiCall();
} catch (err) {
  setError(err.response?.data?.message || 'Error occurred');
}

// After
const { error, handleError } = useErrorHandler();
try {
  await apiCall();
} catch (err) {
  handleError(err);  // Automatically processed
}
```

2. **Update error display**:
```typescript
// Before
{error && <div className="error">{error}</div>}

// After
<ErrorDisplay error={error} onRetry={handleRetry} onDismiss={clearError} />
```

3. **Add error boundaries**:
```typescript
// Wrap components with error boundaries
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

This comprehensive error handling system ensures consistent, user-friendly error experiences while providing developers with powerful tools for error management and debugging.
