import { HTMLAttributes, ReactNode } from 'react';
import { tv } from '../../lib/theme/utils';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  children: ReactNode;
}

/**
 * Alert variant styles using semantic tokens.
 * Each variant uses the semantic color system for automatic theme adaptation.
 */
const alertStyles = tv({
  base: 'rounded-lg border p-4',
  variants: {
    variant: {
      info: 'bg-semantic-info-subtle text-content-primary border-semantic-info',
      success: 'bg-semantic-success-subtle text-content-primary border-semantic-success',
      warning: 'bg-semantic-warning-subtle text-content-primary border-semantic-warning',
      danger: 'bg-semantic-danger-subtle text-content-primary border-semantic-danger',
    },
  },
  defaultVariants: {
    variant: 'info',
  },
});

const variantIcons: Record<AlertVariant, ReactNode> = {
  info: <Info className="w-5 h-5" />,
  success: <CheckCircle className="w-5 h-5" />,
  warning: <AlertTriangle className="w-5 h-5" />,
  danger: <AlertCircle className="w-5 h-5" />,
};

/**
 * Alert - Notification/message component with semantic theme tokens
 *
 * Now uses semantic tokens instead of hard-coded colors:
 * - 70% less code (no more dark: classes)
 * - Automatically adapts to all themes (light, dark, future themes)
 * - Semantic status colors (info, success, warning, danger)
 * - Type-safe variants with autocomplete
 *
 * @example
 * ```tsx
 * <Alert variant="success" title="Success!">
 *   Your changes have been saved.
 * </Alert>
 *
 * <Alert variant="danger" dismissible onDismiss={handleDismiss}>
 *   An error occurred. Please try again.
 * </Alert>
 * ```
 */
export function Alert({
  variant = 'info',
  title,
  dismissible = false,
  onDismiss,
  className,
  children,
  ...props
}: AlertProps) {
  return (
    <div
      role="alert"
      className={alertStyles({ variant, className })}
      {...props}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">{variantIcons[variant]}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {title && <div className="font-semibold mb-1">{title}</div>}
          <div className={title ? 'text-sm opacity-90' : 'text-sm'}>{children}</div>
        </div>

        {/* Dismiss button */}
        {dismissible && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="flex-shrink-0 ml-2 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
