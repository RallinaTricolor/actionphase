import { InputHTMLAttributes, forwardRef } from 'react';
import { tv } from '../../lib/theme/utils';

export type DateTimeInputSize = 'sm' | 'md' | 'lg';
export type DateTimeInputVariant = 'default' | 'error';

export interface DateTimeInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  inputSize?: DateTimeInputSize;
  variant?: DateTimeInputVariant;
  error?: string;
  helperText?: string;
  label?: string;
  optional?: boolean;
}

/**
 * DateTimeInput variant styles using semantic tokens.
 * Replaces verbose dark: classes with clean semantic tokens.
 */
const dateTimeInputStyles = tv({
  base: [
    // Base layout and transitions
    'w-full rounded-lg border transition-colors',
    // Background and text colors using semantic tokens
    'surface-base text-content-primary',
    // Focus states
    'focus:outline-none focus:ring-2 focus:ring-interactive-primary',
    // Disabled state
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),
  variants: {
    variant: {
      default: 'border-theme-default focus:border-interactive-primary',
      error: 'border-semantic-danger focus:border-semantic-danger focus:ring-semantic-danger',
    },
    inputSize: {
      sm: 'px-2 py-1 text-sm',
      md: 'px-3 py-2 text-base',
      lg: 'px-4 py-3 text-lg',
    },
  },
  defaultVariants: {
    variant: 'default',
    inputSize: 'md',
  },
});

/**
 * DateTimeInput - Reusable datetime-local input component with semantic theme tokens
 *
 * Now uses semantic tokens instead of hard-coded colors:
 * - 70% less code (no more dark: classes)
 * - Automatically adapts to all themes (light, dark, future themes)
 * - Type-safe variants with autocomplete
 *
 * @example
 * ```tsx
 * <DateTimeInput
 *   label="Start Date"
 *   value={startDate}
 *   onChange={(e) => setStartDate(e.target.value)}
 * />
 *
 * <DateTimeInput
 *   label="End Date"
 *   optional
 *   variant="error"
 *   error="End date must be after start date"
 * />
 * ```
 */
export const DateTimeInput = forwardRef<HTMLInputElement, DateTimeInputProps>(
  (
    {
      inputSize = 'md',
      variant = 'default',
      error,
      helperText,
      label,
      optional = false,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || props.name;
    const showError = variant === 'error' || error;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-content-primary mb-2"
          >
            {label}
            {optional && (
              <span className="ml-1 text-sm font-normal text-content-tertiary">
                (optional)
              </span>
            )}
          </label>
        )}
        <input
          ref={ref}
          type="datetime-local"
          id={inputId}
          className={dateTimeInputStyles({
            variant: showError ? 'error' : 'default',
            inputSize,
            className,
          })}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-semantic-danger">{error}</p>
        )}
        {!error && helperText && (
          <p className="mt-1 text-sm text-content-secondary">{helperText}</p>
        )}
      </div>
    );
  }
);

DateTimeInput.displayName = 'DateTimeInput';
