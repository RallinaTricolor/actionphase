/**
 * Draft Restoration Utility
 * Handles restoration of form drafts saved before session expiration
 */

import { logger } from '@/services/LoggingService';

export interface DraftData {
  timestamp: number;
  path: string;
  drafts: Record<string, string>;
}

/**
 * Checks if there are saved drafts from a session expiration
 * Returns the draft data if found and still valid (< 24 hours old)
 */
export function getSavedDrafts(): DraftData | null {
  try {
    const draftJson = localStorage.getItem('session_expired_drafts');
    if (!draftJson) {
      return null;
    }

    const draftData: DraftData = JSON.parse(draftJson);

    // Check if drafts are still valid (less than 24 hours old)
    const ageInHours = (Date.now() - draftData.timestamp) / (1000 * 60 * 60);
    if (ageInHours > 24) {
      logger.info('Discarding old drafts', {
        ageInHours: ageInHours.toFixed(1),
        draftCount: Object.keys(draftData.drafts).length,
      });
      localStorage.removeItem('session_expired_drafts');
      return null;
    }

    return draftData;
  } catch (error) {
    logger.error('Failed to retrieve saved drafts', { error });
    return null;
  }
}

/**
 * Restores saved drafts to form fields
 * Returns the number of fields restored
 */
export function restoreDrafts(): number {
  const draftData = getSavedDrafts();
  if (!draftData) {
    return 0;
  }

  let restoredCount = 0;

  try {
    Object.entries(draftData.drafts).forEach(([key, value]) => {
      // Try to find the field by name or id
      const field = document.querySelector<HTMLTextAreaElement | HTMLInputElement>(
        `textarea[name="${key}"], input[name="${key}"], textarea#${key}, input#${key}`
      );

      if (field && !field.value) {
        // Only restore if field is currently empty
        field.value = value;
        restoredCount++;

        // Dispatch input event so React sees the change
        field.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    if (restoredCount > 0) {
      logger.info('Restored drafts to form fields', {
        restoredCount,
        totalDrafts: Object.keys(draftData.drafts).length,
        originalPath: draftData.path,
      });
    }

    // Clear drafts after restoration
    localStorage.removeItem('session_expired_drafts');
  } catch (error) {
    logger.error('Failed to restore drafts', { error });
  }

  return restoredCount;
}

/**
 * Clears saved drafts without restoring them
 */
export function clearSavedDrafts(): void {
  localStorage.removeItem('session_expired_drafts');
  logger.debug('Cleared saved drafts');
}

/**
 * Gets a user-friendly message about saved drafts
 */
export function getDraftMessage(draftData: DraftData): string {
  const draftCount = Object.keys(draftData.drafts).length;
  const timeAgo = getTimeAgo(draftData.timestamp);

  return `We recovered ${draftCount} draft${draftCount > 1 ? 's' : ''} from your previous session (${timeAgo}). Your work has been restored.`;
}

/**
 * Converts a timestamp to a human-readable "time ago" string
 */
function getTimeAgo(timestamp: number): string {
  const minutesAgo = Math.floor((Date.now() - timestamp) / (1000 * 60));

  if (minutesAgo < 1) return 'just now';
  if (minutesAgo === 1) return '1 minute ago';
  if (minutesAgo < 60) return `${minutesAgo} minutes ago`;

  const hoursAgo = Math.floor(minutesAgo / 60);
  if (hoursAgo === 1) return '1 hour ago';
  if (hoursAgo < 24) return `${hoursAgo} hours ago`;

  return 'earlier today';
}
