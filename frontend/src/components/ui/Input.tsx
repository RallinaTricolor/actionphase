import type { InputHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { tv } from '../../lib/theme/utils';

export type InputSize = 'sm' | 'md' | 'lg';
export type InputVariant = 'default' | 'error';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  inputSize?: InputSize;
  variant?: InputVariant;
  error?: string;
  helperText?: string;
  label?: string;
  optional?: boolean;
}

/**
 * Input variant styles using semantic tokens.
 * Replaces verbose dark: classes with clean semantic tokens.
 */
const inputStyles = tv({
  base: [
    // Base layout and transitions
    'w-full rounded-md shadow-sm border transition-colors',
    // Background and text colors using semantic tokens
    'surface-base text-content-primary',
    // Placeholder color (using Tailwind's placeholder modifier)
    'placeholder:text-content-tertiary',
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
 * Input - Reusable input component with semantic theme tokens
 *
 * Now uses semantic tokens instead of hard-coded colors:
 * - 70% less code (no more dark: classes)
 * - Automatically adapts to all themes (light, dark, future themes)
 * - Type-safe variants with autocomplete
 *
 * @example
 * ```tsx
 * <Input
 *   label="Username"
 *   type="text"
 *   placeholder="Enter username"
 *   value={username}
 *   onChange={(e) => setUsername(e.target.value)}
 * />
 *
 * <Input
 *   type="email"
 *   variant="error"
 *   error="Invalid email address"
 * />
 * ```
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
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
          id={inputId}
          className={inputStyles({
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

Input.displayName = 'Input';
