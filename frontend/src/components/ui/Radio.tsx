import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/theme/utils';

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helperText?: string;
}

/**
 * Radio - Radio button input component with semantic theme tokens
 *
 * Now uses semantic tokens instead of hard-coded colors:
 * - 70% less code (no more dark: classes)
 * - Automatically adapts to all themes (light, dark, future themes)
 *
 * @example
 * ```tsx
 * <Radio
 *   name="plan"
 *   value="basic"
 *   label="Basic Plan"
 *   checked={plan === 'basic'}
 *   onChange={(e) => setPlan(e.target.value)}
 * />
 *
 * <Radio
 *   name="plan"
 *   value="pro"
 *   label="Pro Plan"
 *   helperText="Includes all features"
 * />
 * ```
 */
export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    const radioId = id || `${props.name}-${props.value}`;

    return (
      <div className="flex items-start">
        <div className="flex items-center h-5">
          <input
            ref={ref}
            id={radioId}
            type="radio"
            className={cn(
              // Base styles
              'w-4 h-4 border transition-colors cursor-pointer',
              // Colors using semantic tokens
              'surface-base text-interactive-primary border-theme-default',
              // Focus states
              'focus:ring-2 focus:ring-interactive-primary',
              // Disabled state
              'disabled:opacity-50 disabled:cursor-not-allowed',
              // Error state
              error && 'border-semantic-danger focus:ring-semantic-danger',
              // Custom className
              className
            )}
            {...props}
          />
        </div>
        {(label || helperText || error) && (
          <div className="ml-3">
            {label && (
              <label
                htmlFor={radioId}
                className="text-sm font-medium text-content-primary cursor-pointer"
              >
                {label}
              </label>
            )}
            {error && <p className="text-sm text-semantic-danger mt-1">{error}</p>}
            {!error && helperText && (
              <p className="text-sm text-content-secondary mt-1">{helperText}</p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Radio.displayName = 'Radio';
