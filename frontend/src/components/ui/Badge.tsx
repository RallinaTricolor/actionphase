import { HTMLAttributes, ReactNode } from 'react';
import { tv } from '../../lib/theme/utils';

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  children: ReactNode;
}

/**
 * Badge variant styles using semantic tokens.
 * Each variant uses the semantic color system for automatic theme adaptation.
 */
const badgeStyles = tv({
  base: 'inline-flex items-center gap-1.5 rounded-full font-medium border',
  variants: {
    variant: {
      primary: 'bg-semantic-info-subtle text-content-primary border-semantic-info',
      secondary: 'surface-raised text-content-primary border-theme-default',
      success: 'bg-semantic-success-subtle text-content-primary border-semantic-success',
      warning: 'bg-semantic-warning-subtle text-content-primary border-semantic-warning',
      danger: 'bg-semantic-danger-subtle text-content-primary border-semantic-danger',
      neutral: 'surface-raised text-content-secondary border-theme-subtle',
    },
    size: {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-0.5 text-sm',
      lg: 'px-3 py-1 text-base',
    },
  },
  defaultVariants: {
    variant: 'neutral',
    size: 'md',
  },
});

/**
 * Dot indicator styles using semantic tokens.
 */
const dotStyles = tv({
  base: 'w-1.5 h-1.5 rounded-full',
  variants: {
    variant: {
      primary: 'bg-semantic-info',
      secondary: 'bg-content-primary',
      success: 'bg-semantic-success',
      warning: 'bg-semantic-warning',
      danger: 'bg-semantic-danger',
      neutral: 'bg-content-secondary',
    },
  },
  defaultVariants: {
    variant: 'neutral',
  },
});

/**
 * Badge - Status indicator component with semantic theme tokens
 *
 * Now uses semantic tokens instead of hard-coded colors:
 * - 70% less code (no more dark: classes)
 * - Automatically adapts to all themes (light, dark, future themes)
 * - Semantic status colors (success, warning, danger)
 * - Type-safe variants with autocomplete
 *
 * @example
 * ```tsx
 * <Badge variant="success">Active</Badge>
 * <Badge variant="warning" size="sm">Pending</Badge>
 * <Badge variant="danger" dot>Urgent</Badge>
 * ```
 */
export function Badge({
  variant = 'neutral',
  size = 'md',
  dot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={badgeStyles({ variant, size, className })}
      {...props}
    >
      {dot && <span className={dotStyles({ variant })} />}
      {children}
    </span>
  );
}
