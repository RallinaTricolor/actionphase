import { useEffect, useRef } from 'react';
import { getSavedDrafts, clearSavedDrafts } from '@/utils/draftRestoration';
import { logger } from '@/services/LoggingService';

/**
 * Custom hook to automatically restore draft values for form fields
 *
 * Usage:
 * ```tsx
 * const [content, setContent] = useState('');
 * useDraftRestoration('gm-post-content', content, setContent);
 * ```
 *
 * @param fieldName - Unique name/id of the field (matches name/id attribute)
 * @param currentValue - Current field value
 * @param setValue - State setter function
 */
export function useDraftRestoration(
  fieldName: string,
  currentValue: string,
  setValue: (value: string) => void
) {
  const hasRestored = useRef(false);

  useEffect(() => {
    // Only restore once per component mount
    if (hasRestored.current) return;

    // Only restore if field is currently empty
    if (currentValue && currentValue.trim().length > 0) return;

    const draftData = getSavedDrafts();
    if (!draftData) return;

    const draftValue = draftData.drafts[fieldName];
    if (draftValue && draftValue.trim().length > 0) {
      logger.info('Restoring draft for field', {
        fieldName,
        valueLength: draftValue.length,
        originalPath: draftData.path,
      });

      setValue(draftValue);
      hasRestored.current = true;

      // Clear the specific draft after restoration
      // This prevents it from being restored multiple times
      delete draftData.drafts[fieldName];

      // If no more drafts remain, clear the entire storage
      if (Object.keys(draftData.drafts).length === 0) {
        clearSavedDrafts();
        logger.debug('All drafts restored, cleared localStorage');
      } else {
        // Save back the remaining drafts
        localStorage.setItem('session_expired_drafts', JSON.stringify(draftData));
      }
    }
  }, [fieldName, currentValue, setValue]);
}
