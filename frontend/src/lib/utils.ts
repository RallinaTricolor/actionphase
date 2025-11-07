/**
 * Utility functions for the application
 */

/**
 * Get initials from a name
 * @param name - Full name (e.g., "John Doe" or "Alice")
 * @returns Initials (e.g., "JD" or "A")
 */
export function getInitials(name: string): string {
  if (!name || name.trim() === '') return '?';

  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) {
    // Single word - take first letter
    return parts[0][0].toUpperCase();
  }

  // Multiple words - take first letter of first and last word
  const firstInitial = parts[0][0];
  const lastInitial = parts[parts.length - 1][0];

  return (firstInitial + lastInitial).toUpperCase();
}

/**
 * Truncate text to a maximum length
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text with ellipsis if needed
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format a number with commas (e.g., 1000 => "1,000")
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}
