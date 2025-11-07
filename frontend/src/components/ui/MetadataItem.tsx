import React from 'react';

export interface MetadataItemProps {
  icon: React.ReactNode;
  label: string;
  value?: string | React.ReactNode;
  className?: string;
}

/**
 * MetadataItem Component
 *
 * Displays a metadata item with an icon and text in a consistent format.
 * Useful for game cards, post headers, and other information-dense areas.
 *
 * @example
 * <MetadataItem
 *   icon={<ClockIcon />}
 *   label="Deadline"
 *   value="2 hours"
 * />
 */
export function MetadataItem({ icon, label, value, className = '' }: MetadataItemProps) {
  return (
    <div className={`flex items-center gap-1.5 text-sm text-content-secondary ${className}`}>
      <span className="flex-shrink-0 w-4 h-4 text-content-tertiary">
        {icon}
      </span>
      <span className="font-medium">{label}:</span>
      {value && <span>{value}</span>}
    </div>
  );
}

/**
 * MetadataGroup Component
 *
 * Groups related metadata items with optional background and dividers.
 *
 * @example
 * <MetadataGroup>
 *   <MetadataItem icon={<Icon />} label="Players" value="3/5" />
 *   <MetadataItem icon={<Icon />} label="Phase" value="Action" />
 * </MetadataGroup>
 */
export function MetadataGroup({
  children,
  className = '',
  withBackground = false,
  withDividers = false
}: {
  children: React.ReactNode;
  className?: string;
  withBackground?: boolean;
  withDividers?: boolean;
}) {
  const bgClass = withBackground ? 'bg-surface-raised rounded-lg p-3' : '';
  const dividerClass = withDividers ? 'divide-y divide-border-primary' : 'space-y-2';

  return (
    <div className={`${bgClass} ${dividerClass} ${className}`}>
      {children}
    </div>
  );
}

/**
 * MetadataSeparator Component
 *
 * Visual separator between metadata items (dot or line).
 */
export function MetadataSeparator({ type = 'dot' }: { type?: 'dot' | 'line' }) {
  if (type === 'line') {
    return <div className="h-4 w-px bg-border-primary mx-2" />;
  }

  return <span className="text-content-tertiary mx-1.5">•</span>;
}

export default MetadataItem;
