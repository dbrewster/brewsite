// useNativeScrollSource.ts — Creates a hidden off-screen scroll container with native OS scroll physics.

import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import type { IScrollSource } from './scrollSourceTypes';

/**
 * Options for useNativeScrollSource.
 */
export interface UseNativeScrollSourceOptions {
  /** Total scroll distance in pixels. Update when scene count or scroll units change. */
  heightPx: number;
}

/**
 * Result from useNativeScrollSource.
 */
export interface UseNativeScrollSourceResult {
  /** Pass to ScrollInput source prop. */
  source: IScrollSource;
  /** Attach to the hidden scroll container div (consumers render it off-screen). */
  ref: RefObject<HTMLDivElement | null>;
}

/**
 * Creates a hidden off-screen scroll container that produces native OS scroll physics.
 * The consumer must render the ref div off-screen and wire source to ScrollInput.
 */
export function useNativeScrollSource(
  options: UseNativeScrollSourceOptions,
): UseNativeScrollSourceResult {
  const divRef = useRef<HTMLDivElement | null>(null);
  const subscribersRef = useRef<Set<(raw: number) => void>>(new Set());
  const heightPx = options.heightPx;

  const source: IScrollSource = useMemo(() => ({
    subscribe(onProgress: (raw: number) => void): () => void {
      subscribersRef.current.add(onProgress);
      return () => subscribersRef.current.delete(onProgress);
    },
    scrollTo(rawProgress: number): void {
      const div = divRef.current;
      if (!div) return;
      div.scrollTop = rawProgress * Math.max(1, heightPx - window.innerHeight);
    },
  }), [heightPx]);

  useEffect(() => {
    const div = divRef.current;
    if (!div) return;

    const onScroll = () => {
      const max = Math.max(1, heightPx - window.innerHeight);
      const raw = Math.max(0, Math.min(1, div.scrollTop / max));
      subscribersRef.current.forEach((cb) => cb(raw));
    };

    div.addEventListener('scroll', onScroll, { passive: true });
    return () => div.removeEventListener('scroll', onScroll);
  }, [heightPx]);

  return { source, ref: divRef };
}
