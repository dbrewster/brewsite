// Fetch + compile convenience hook for loading MDX from a URL.

import { useState, useEffect, useRef } from 'react';
import { useMdxCompile } from './useMdxCompile';
import type { UseMdxFetchOptions, UseMdxFetchResult } from './types';

/**
 * Fetches MDX content from a URL and compiles it to a React component.
 * Caches both the fetched source and the compiled result.
 *
 * Fetch and compilation states are tracked separately so consumers can
 * distinguish network errors from MDX syntax errors.
 */
export function useMdxFetch(url: string | null, options?: UseMdxFetchOptions): UseMdxFetchResult {
  const [fetchedSource, setFetchedSource] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(url !== null);
  const [fetchError, setFetchError] = useState<Error | null>(null);

  // Track the current URL + revalidateKey to cancel stale fetches
  const urlRef = useRef(url);
  urlRef.current = url;

  const revalidateKey = options?.revalidateKey;

  useEffect(() => {
    if (url === null) {
      setFetchedSource(null);
      setIsFetching(false);
      setFetchError(null);
      return;
    }

    setIsFetching(true);
    setFetchError(null);

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(url, options?.fetchOptions);
        if (!response.ok) {
          throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
        }
        const text = await response.text();

        if (cancelled || urlRef.current !== url) return;

        setFetchedSource(text);
        setIsFetching(false);
      } catch (err) {
        if (cancelled || urlRef.current !== url) return;

        setFetchError(err instanceof Error ? err : new Error(String(err)));
        setFetchedSource(null);
        setIsFetching(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, revalidateKey]);

  const compileResult = useMdxCompile(fetchedSource);

  return {
    ...compileResult,
    isFetching,
    fetchError,
  };
}
