import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

interface UseUrlParamOptions<T> {
  /**
   * Whether setting the param replaces the current history entry (true)
   * or pushes a new one (false). Default: false.
   */
  replace?: boolean;
  /** Convert the param value from string → T. Default: identity (string). */
  deserialize?: (raw: string) => T;
  /** Convert T → string for storage in the URL. Default: String(). */
  serialize?: (value: T) => string;
}

/**
 * Syncs a single URL search parameter to component state.
 *
 * Returns [value, setValue] where value is always sourced from the URL.
 * If the param is absent the defaultValue is returned (but NOT written to the URL).
 *
 * @example — string param
 * const [subTab, setSubTab] = useUrlParam('subTab', 'submissions');
 *
 * @example — number param (phase ID)
 * const [phaseId, setPhaseId] = useUrlParam<number | null>('phase', null, {
 *   deserialize: (s) => parseInt(s, 10) || null,
 *   serialize: (v) => v == null ? '' : String(v),
 * });
 *
 * @example — replace instead of push (avoid back-button bloat when clearing)
 * const [commentId, setCommentId] = useUrlParam('comment', null, { replace: true });
 */
export function useUrlParam<T extends string | null>(
  key: string,
  defaultValue: T,
  options?: UseUrlParamOptions<T>
): [T, (value: T) => void];

export function useUrlParam<T>(
  key: string,
  defaultValue: T,
  options: UseUrlParamOptions<T> & {
    deserialize: (raw: string) => T;
    serialize: (value: T) => string;
  }
): [T, (value: T) => void];

export function useUrlParam<T>(
  key: string,
  defaultValue: T,
  options: UseUrlParamOptions<T> = {}
): [T, (value: T) => void] {
  const { replace = false, deserialize, serialize } = options;
  const [searchParams, setSearchParams] = useSearchParams();

  const raw = searchParams.get(key);

  let value: T;
  if (raw === null) {
    value = defaultValue;
  } else if (deserialize) {
    value = deserialize(raw);
  } else {
    value = raw as unknown as T;
  }

  const setValue = useCallback(
    (newValue: T) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const serialized = serialize ? serialize(newValue) : String(newValue);
          if (serialized === '' || serialized === 'null' || newValue === null || newValue === undefined) {
            next.delete(key);
          } else {
            next.set(key, serialized);
          }
          return next;
        },
        { replace }
      );
    },
    [key, replace, serialize, setSearchParams]
  );

  return [value, setValue];
}
