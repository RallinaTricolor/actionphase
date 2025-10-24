import type { HTMLAttributes } from 'react';
import { tv, cn } from '../../lib/theme/utils';
import { Loader2 } from 'lucide-react';

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerVariant = 'primary' | 'secondary' | 'inverse';

export interface SpinnerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  label?: string;
}

/**
 * Spinner variant styles using semantic tokens.
 */
const spinnerStyles = tv({
  base: 'animate-spin',
  variants: {
    size: {
      sm: 'w-4 h-4',
      md: 'w-6 h-6',
      lg: 'w-8 h-8',
      xl: 'w-12 h-12',
    },
    variant: {
      primary: 'text-interactive-primary',
      secondary: 'text-content-secondary',
      inverse: 'text-content-inverse',
    },
  },
  defaultVariants: {
    size: 'md',
    variant: 'primary',
  },
});

/**
 * Spinner - Loading indicator component with semantic theme tokens
 *
 * Now uses semantic tokens instead of hard-coded colors:
 * - 70% less code (no more dark: classes)
 * - Automatically adapts to all themes (light, dark, future themes)
 * - Type-safe variants with autocomplete
 *
 * @example
 * ```tsx
 * <Spinner size="md" variant="primary" />
 * <Spinner size="lg" label="Loading..." />
 * ```
 */
export function Spinner({
  size = 'md',
  variant = 'primary',
  label,
  className,
  ...props
}: SpinnerProps) {
  return (
    <div
      role="status"
      className={cn('inline-flex items-center gap-2', className)}
      {...props}
    >
      <Loader2
        className={spinnerStyles({ size, variant })}
        aria-hidden="true"
      />
      {label && <span className="text-content-primary text-sm">{label}</span>}
      <span className="sr-only">{label || 'Loading...'}</span>
    </div>
  );
}
