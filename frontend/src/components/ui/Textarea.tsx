import { forwardRef } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import { tv } from '../../lib/theme/utils';

export type TextareaSize = 'sm' | 'md' | 'lg';
export type TextareaVariant = 'default' | 'error';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  textareaSize?: TextareaSize;
  variant?: TextareaVariant;
  error?: string;
  helperText?: string;
  label?: string;
  optional?: boolean;
}

/**
 * Textarea variant styles using semantic tokens.
 * Replaces verbose dark: classes with clean semantic tokens.
 */
const textareaStyles = tv({
  base: [
    // Base layout and transitions
    'w-full rounded-lg border transition-colors resize-none',
    // Background and text colors using semantic tokens
    'surface-base text-content-primary',
    // Placeholder color
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
    textareaSize: {
      sm: 'px-2 py-1 text-sm',
      md: 'px-3 py-2 text-base',
      lg: 'px-4 py-3 text-lg',
    },
  },
  defaultVariants: {
    variant: 'default',
    textareaSize: 'md',
  },
});

/**
 * Textarea - Reusable textarea component with semantic theme tokens
 *
 * Now uses semantic tokens instead of hard-coded colors:
 * - 70% less code (no more dark: classes)
 * - Automatically adapts to all themes (light, dark, future themes)
 * - Type-safe variants with autocomplete
 *
 * @example
 * ```tsx
 * <Textarea
 *   label="Description"
 *   placeholder="Enter description"
 *   value={description}
 *   onChange={(e) => setDescription(e.target.value)}
 *   rows={4}
 * />
 *
 * <Textarea
 *   variant="error"
 *   error="Description is required"
 * />
 * ```
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      textareaSize = 'md',
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
    const textareaId = id || props.name;
    const showError = variant === 'error' || error;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
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
        <textarea
          ref={ref}
          id={textareaId}
          className={textareaStyles({
            variant: showError ? 'error' : 'default',
            textareaSize,
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

Textarea.displayName = 'Textarea';
