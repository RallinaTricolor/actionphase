import { HTMLAttributes, ReactNode } from 'react';
import { tv, cn } from '../../lib/theme/utils';

export type CardVariant = 'default' | 'elevated' | 'bordered' | 'danger' | 'warning' | 'success';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  children: ReactNode;
}

/**
 * Card variant styles using semantic tokens.
 * No more dark: classes needed!
 */
const cardStyles = tv({
  base: 'rounded-lg transition-shadow',
  variants: {
    variant: {
      default: 'surface-base border border-theme-default',
      elevated: 'surface-base shadow-lg',
      bordered: 'surface-base border-2 border-theme-strong',
      danger: 'bg-semantic-danger-subtle border-2 border-semantic-danger shadow-lg',
      warning: 'bg-semantic-warning-subtle border-2 border-semantic-warning shadow-lg',
      success: 'bg-semantic-success-subtle border-2 border-semantic-success shadow-lg',
    },
    padding: {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    },
  },
  defaultVariants: {
    variant: 'default',
    padding: 'md',
  },
});

/**
 * Card - Reusable card container component with semantic theme tokens
 *
 * Now uses semantic tokens that automatically work with any theme:
 * - surface-base: Primary card background
 * - border-theme-default: Standard borders
 * - Semantic colors for status cards (danger, warning, success)
 *
 * Variants:
 * - default: Standard card with subtle border
 * - elevated: Card with shadow elevation
 * - bordered: Card with prominent border
 * - danger: Danger state card (errors, urgent items)
 * - warning: Warning state card
 * - success: Success state card
 *
 * @example
 * ```tsx
 * <Card variant="elevated" padding="md">
 *   <h3>Card Title</h3>
 *   <p>Card content goes here</p>
 * </Card>
 *
 * <Card variant="danger" padding="lg">
 *   <h3>Urgent Action Required</h3>
 * </Card>
 * ```
 */
export function Card({
  variant = 'default',
  padding = 'md',
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cardStyles({ variant, padding, className })}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * CardHeader - Optional header section for Card
 */
export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn('mb-4 pb-4 border-b border-theme-default', className)}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * CardBody - Optional body section for Card
 */
export interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardBody({ className, children, ...props }: CardBodyProps) {
  return (
    <div className={cn('space-y-4', className)} {...props}>
      {children}
    </div>
  );
}

/**
 * CardFooter - Optional footer section for Card
 */
export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div
      className={cn('mt-4 pt-4 border-t border-theme-default', className)}
      {...props}
    >
      {children}
    </div>
  );
}
