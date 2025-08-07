// Frontend error types that match the backend ErrResponse structure
export interface ApiError {
  status: string;
  code?: number;
  error?: string;
}

// Enhanced error interface with additional frontend context
export interface AppError extends Error {
  type: ErrorType;
  statusCode?: number;
  apiError?: ApiError;
  context?: Record<string, unknown>;
}

export enum ErrorType {
  // Network/API errors
  NETWORK_ERROR = 'network_error',
  API_ERROR = 'api_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  AUTHORIZATION_ERROR = 'authorization_error',

  // Client-side errors
  VALIDATION_ERROR = 'validation_error',
  COMPONENT_ERROR = 'component_error',
  NAVIGATION_ERROR = 'navigation_error',

  // Business logic errors
  GAME_STATE_ERROR = 'game_state_error',
  CHARACTER_ERROR = 'character_error',

  // Unknown errors
  UNKNOWN_ERROR = 'unknown_error'
}

// Error categories for different handling strategies
export enum ErrorCategory {
  RECOVERABLE = 'recoverable',       // User can retry or take action
  NON_RECOVERABLE = 'non_recoverable', // Requires page reload or navigation
  SILENT = 'silent'                   // Log but don't display to user
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',       // Minor issues, app continues normally
  MEDIUM = 'medium', // Some functionality affected
  HIGH = 'high',     // Major functionality broken
  CRITICAL = 'critical' // App unusable
}

// Enhanced error context with metadata
export interface ErrorContext {
  type: ErrorType;
  category: ErrorCategory;
  severity: ErrorSeverity;
  userMessage: string;
  technicalMessage?: string;
  actionable?: boolean;
  recoveryActions?: string[];
  timestamp: Date;
  source?: string;
  metadata?: Record<string, unknown>;
}

// Standard error messages that align with backend responses
export const ERROR_MESSAGES = {
  // Authentication
  INVALID_CREDENTIALS: 'Invalid username or password',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  UNAUTHORIZED: 'You are not authorized to perform this action',

  // Network
  NETWORK_UNAVAILABLE: 'Unable to connect to server. Please check your connection.',
  REQUEST_TIMEOUT: 'Request timed out. Please try again.',

  // Validation
  REQUIRED_FIELD: 'This field is required',
  INVALID_FORMAT: 'Please enter a valid format',

  // Game-specific
  GAME_FULL: 'This game is full and not accepting new players',
  GAME_NOT_RECRUITING: 'This game is not currently recruiting players',
  INVALID_GAME_STATE: 'Cannot perform this action in the current game state',

  // Generic fallbacks
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
  SERVER_ERROR: 'Server error occurred. Please try again later.'
} as const;

// HTTP status code to error type mapping
export const STATUS_CODE_TO_ERROR_TYPE: Record<number, ErrorType> = {
  400: ErrorType.VALIDATION_ERROR,
  401: ErrorType.AUTHENTICATION_ERROR,
  403: ErrorType.AUTHORIZATION_ERROR,
  404: ErrorType.API_ERROR,
  409: ErrorType.VALIDATION_ERROR,
  422: ErrorType.VALIDATION_ERROR,
  500: ErrorType.API_ERROR,
  502: ErrorType.NETWORK_ERROR,
  503: ErrorType.NETWORK_ERROR,
  504: ErrorType.NETWORK_ERROR,
} as const;
