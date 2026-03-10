// usePauseWhenHidden.ts — Shared IntersectionObserver hook for input visibility gating.

import { useEffect } from 'react';
import type { RefObject } from 'react';

/** Visibility threshold options for pauseWhenHidden on input components. */
export type PauseWhenHiddenOptions = {
  /** Fraction of width that must be visible. Default: 0.0 */
  x?: number;
  /** Fraction of height that must be visible. Default: 0.8 */
  y?: number;
};

/**
 * Shared hook for input component visibility gating via IntersectionObserver.
 * Observes the element at `ref`, calls `onPauseChange(true)` when intersection
 * falls below threshold, `onPauseChange(false)` when it recovers.
 *
 * @param ref          Ref to the element to observe (usually the input component's anchor div).
 * @param options      Threshold options. Undefined = no observer (hook is a no-op).
 * @param onPauseChange  Called with `true` on hide, `false` on show.
 */
export function usePauseWhenHidden(
  ref: RefObject<HTMLElement | null>,
  options: PauseWhenHiddenOptions | undefined,
  onPauseChange: (paused: boolean) => void,
): void {
  useEffect(() => {
    if (!options) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    // Note: IntersectionObserver thresholds are by area fraction by default.
    // Full x/y independent gating is an approximation; this is acceptable per PRD §11.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const isHidden = !entry.isIntersecting || entry.intersectionRatio < (options.y ?? 0.8);
        onPauseChange(isHidden);
      },
      { threshold: options.y ?? 0.8 },
    );

    observer.observe(el);
    return () => observer.disconnect();
    // onPauseChange intentionally not in deps — use a stable callback at call site
  }, [ref, options?.x, options?.y]); // eslint-disable-line react-hooks/exhaustive-deps
}
