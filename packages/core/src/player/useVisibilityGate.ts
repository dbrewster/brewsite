// useVisibilityGate.ts — Viewport-aware mount/pause lifecycle hook.

import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/** Controls engine mount lifecycle and rendering behavior relative to viewport visibility. */
export type VisibilityMode = 'always' | 'autopause' | 'lazy';

/**
 * Result of the visibility gate hook.
 *
 * `mounted` controls whether the engine subtree is rendered in the React tree.
 * `visible` controls whether the engine's RAF loop should be active.
 */
export interface VisibilityGateResult {
  /**
   * Whether the engine subtree should be mounted in the React tree.
   * - 'always' | 'autopause': always true.
   * - 'lazy': true once the container enters the extended viewport
   *   (rootMargin). Reverts to false when the container leaves the
   *   extended viewport (after 500ms debounce).
   */
  readonly mounted: boolean;

  /**
   * Whether the embed is currently visible in the viewport.
   * Used to pause/resume the engine's RAF loop.
   * - 'always': always true.
   * - 'autopause' | 'lazy': true when the container intersects the
   *   viewport (with rootMargin), AND the document is not hidden.
   */
  readonly visible: boolean;
}

/**
 * Combines IntersectionObserver (scroll visibility) and
 * document.visibilitychange (tab switching) into a single
 * mount/visible state pair.
 *
 * @beta This hook is exported for advanced consumers building custom
 * embed layouts. The API may change in a future minor release.
 *
 * @param containerRef  Ref to the outer container element.
 * @param mode          Visibility lifecycle mode.
 * @param rootMargin    IntersectionObserver rootMargin. Default: '200px'.
 */
export function useVisibilityGate(
  containerRef: RefObject<HTMLElement | null>,
  mode: VisibilityMode,
  rootMargin: string = '200px',
): VisibilityGateResult {
  // 'always' mode: no observers, always mounted and visible.
  const [mounted, setMounted] = useState<boolean>(mode !== 'lazy');
  const [visible, setVisible] = useState<boolean>(mode !== 'lazy');

  // Track intersection state synchronously for combining with document.hidden.
  const isIntersectingRef = useRef<boolean>(mode === 'autopause');

  // Debounce timer ref for lazy mode unmount.
  const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (mode === 'always') return;

    // SSR fallback: when IntersectionObserver is unavailable, mount and show.
    if (typeof IntersectionObserver === 'undefined') {
      setMounted(true);
      setVisible(true);
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    // ── Derived state helpers ──────────────────────────────────────────────
    const computeVisible = (intersecting: boolean): boolean =>
      intersecting && !document.hidden;

    // ── IntersectionObserver ───────────────────────────────────────────────
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const intersecting = entry.isIntersecting;
        isIntersectingRef.current = intersecting;

        // Update visible immediately (cheap RAF pause/resume).
        setVisible(computeVisible(intersecting));

        if (mode === 'lazy') {
          if (intersecting) {
            // Clear any pending unmount debounce.
            if (unmountTimerRef.current !== null) {
              clearTimeout(unmountTimerRef.current);
              unmountTimerRef.current = null;
            }
            setMounted(true);
          } else {
            // Debounce unmount by 500ms to prevent rapid mount/unmount cycling.
            if (unmountTimerRef.current === null) {
              unmountTimerRef.current = setTimeout(() => {
                unmountTimerRef.current = null;
                setMounted(false);
              }, 500);
            }
          }
        }
      },
      { rootMargin },
    );

    observer.observe(el);

    // ── document.visibilitychange ──────────────────────────────────────────
    const onVisibilityChange = (): void => {
      setVisible(computeVisible(isIntersectingRef.current));
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (unmountTimerRef.current !== null) {
        clearTimeout(unmountTimerRef.current);
        unmountTimerRef.current = null;
      }
    };
  }, [containerRef, mode, rootMargin]);

  return { mounted, visible };
}
