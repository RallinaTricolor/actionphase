/**
 * Date utility functions for consistent date formatting across the application
 */

/**
 * Converts a datetime-local string to ISO 8601 format (RFC3339)
 *
 * The DateTimeInput component returns dates in YYYY-MM-DDTHH:mm format,
 * but the backend expects full ISO 8601/RFC3339 format with seconds and timezone.
 *
 * @param dateTimeLocal - Date string in YYYY-MM-DDTHH:mm format (e.g., "2025-11-10T14:30")
 * @returns ISO 8601 formatted string (e.g., "2025-11-10T14:30:00Z") or empty string if input is falsy
 *
 * @example
 * ```typescript
 * convertToISO8601("2025-11-10T14:30") // "2025-11-10T14:30:00Z"
 * convertToISO8601("") // ""
 * convertToISO8601(undefined) // ""
 * ```
 */
export function convertToISO8601(dateTimeLocal: string | undefined): string {
  if (!dateTimeLocal) return '';
  // dateTimeLocal format: "YYYY-MM-DDTHH:mm"
  // ISO 8601 format needed: "YYYY-MM-DDTHH:mm:ssZ"
  // Add seconds and UTC timezone indicator
  return `${dateTimeLocal}:00Z`;
}

/**
 * Formats a date string or Date object for datetime-local input
 *
 * @param date - ISO 8601 date string or Date object
 * @returns String in YYYY-MM-DDTHH:mm format for datetime-local inputs
 *
 * @example
 * ```typescript
 * formatDateTimeLocal("2025-11-10T14:30:00Z") // "2025-11-10T14:30"
 * formatDateTimeLocal(new Date("2025-11-10T14:30:00Z")) // "2025-11-10T14:30"
 * ```
 */
export function formatDateTimeLocal(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
