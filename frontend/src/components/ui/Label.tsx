import { LabelHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/theme/utils';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  optional?: boolean;
  error?: boolean;
  children: ReactNode;
}

/**
 * Label - Form label component with semantic theme tokens
 *
 * Now uses semantic tokens instead of hard-coded colors:
 * - 70% less code (no more dark: classes)
 * - Automatically adapts to all themes (light, dark, future themes)
 *
 * @example
 * ```tsx
 * <Label htmlFor="email">Email</Label>
 * <Label htmlFor="name" required>Full Name</Label>
 * <Label htmlFor="bio" optional>Biography</Label>
 * <Label htmlFor="error-field" error>Invalid Field</Label>
 * ```
 */
export function Label({
  required = false,
  optional = false,
  error = false,
  className,
  children,
  ...props
}: LabelProps) {
  return (
    <label
      className={cn(
        'block text-sm font-medium mb-2',
        error ? 'text-semantic-danger' : 'text-content-primary',
        className
      )}
      {...props}
    >
      {children}
      {required && (
        <span className="text-semantic-danger ml-1" aria-label="required">
          *
        </span>
      )}
      {optional && (
        <span className="text-content-secondary ml-1 font-normal">(optional)</span>
      )}
    </label>
  );
}
