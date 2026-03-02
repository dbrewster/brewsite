import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { SceneProgressMapper } from './SceneProgressMapper';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export type UseEngineScrollOptions = {
  scrollRegionRef: RefObject<HTMLElement | null>;
  scrollRegionHeightPx: number;
  /**
   * Optional progress mapper. When provided, raw scroll progress is remapped
   * to engine progress via the mapper's remap() method, and scrollToProgress()
   * inverts through the mapper before setting the scroll position.
   * Null means identity mapping (no remapping).
   */
  progressMapper?: SceneProgressMapper | null;
  /**
   * Called when a genuine user scroll event fires (NOT when auto-advance calls
   * window.scrollTo). Used by useSceneEngine to update lastUserScrollTimeRef
   * for the pauseOnScroll debounce.
   */
  onUserScroll?: () => void;
};

export type UseEngineScrollResult = {
  progress: number;
  scrollToProgress: (next: number) => void;
  getGlobalProgress: () => number;
  /**
   * Returns the pre-mapper raw scroll progress [0..1].
   * Unlike getGlobalProgress() which returns the post-mapper (engine) progress,
   * this returns the raw scroll fraction before the SceneProgressMapper is applied.
   * Used by auto-advance to read and write in the correct space.
   */
  getRawProgress(): number;
  /**
   * Advances window.scrollY to the position corresponding to the given raw progress value.
   * Bypasses the mapper entirely — raw input space, not engine progress space.
   * Used by auto-advance to avoid the raw→engine→raw round-trip through the mapper.
   *
   * Marks the scroll as programmatic so onUserScroll is NOT fired for this event.
   */
  scrollToRawProgress(raw: number): void;
  /**
   * Directly writes the given raw progress value into rawProgressRef and
   * progressRef WITHOUT calling window.scrollTo or firing any scroll event.
   *
   * Used by the auto-advance state machine to synchronize the scroll-derived
   * refs when auto-advance stops. This avoids the suppress-scroll-event
   * mechanism, which is unreliable because window.scrollTo may be a no-op in
   * jsdom (and in real browsers when already at the target position).
   *
   * Calling this keeps rawProgressRef / progressRef in sync so that
   * getGlobalProgress() returns the correct value the instant
   * autoAdvanceRawRef is cleared, with no one-frame gap.
   */
  forceRawProgress(raw: number): void;
};

export const useEngineScroll = (options: UseEngineScrollOptions): UseEngineScrollResult => {
  const { scrollRegionRef, scrollRegionHeightPx, progressMapper } = options;
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const rawProgressRef = useRef(0);

  const computeProgress = useCallback((): { raw: number; mapped: number } => {
    if (typeof window === 'undefined') return { raw: 0, mapped: 0 };
    const el = scrollRegionRef.current;
    if (!el) return { raw: 0, mapped: 0 };

    const rect = el.getBoundingClientRect();
    const scrollTop = window.scrollY || window.pageYOffset || 0;
    const regionTop = scrollTop + rect.top;
    const viewportHeight = window.innerHeight || 1;
    const maxScroll = Math.max(1, scrollRegionHeightPx - viewportHeight);
    const raw = clamp01((scrollTop - regionTop) / maxScroll);
    const mapped = progressMapper ? progressMapper.remap(raw) : raw;
    return { raw, mapped };
  }, [scrollRegionHeightPx, scrollRegionRef, progressMapper]);

  const update = useCallback(() => {
    const { raw, mapped } = computeProgress();
    if (Math.abs(mapped - progressRef.current) < 1e-5) return;
    rawProgressRef.current = raw;
    progressRef.current = mapped;
    setProgress(mapped);
  }, [computeProgress]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    update();
    const onScroll = () => {
      // IMPORTANT: call update() BEFORE onUserScroll() so that rawProgressRef
      // and progressRef reflect the new scroll position by the time
      // handleUserScroll (in useSceneEngine) runs and potentially clears
      // autoAdvanceRawRef. Without this ordering, getGlobalProgress() would
      // fall through to a stale rawProgressRef value (typically 0) for one
      // frame after autoAdvanceRawRef is cleared, causing a visible snap.
      update();
      // Every scroll event reaching this listener is a genuine user scroll.
      // Auto-advance does not call window.scrollTo for its internal progress
      // tracking — it uses autoAdvanceRawRef and forceRawProgress() instead.
      options.onUserScroll?.();
    };
    const onResize = () => update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  // options.onUserScroll is intentionally excluded from deps — it is a callback ref pattern.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update]);

  const scrollToProgress = useCallback(
    (next: number) => {
      if (typeof window === 'undefined') return;
      const el = scrollRegionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollTop = window.scrollY || window.pageYOffset || 0;
      const regionTop = scrollTop + rect.top;
      const viewportHeight = window.innerHeight || 1;
      const maxScroll = Math.max(1, scrollRegionHeightPx - viewportHeight);
      // Invert through mapper to convert engine progress back to raw scroll position
      const rawTarget = progressMapper
        ? progressMapper.inverse(clamp01(next))
        : clamp01(next);
      const target = regionTop + rawTarget * maxScroll;
      window.scrollTo({ top: target });
    },
    [scrollRegionHeightPx, scrollRegionRef, progressMapper],
  );

  const scrollToRawProgress = useCallback(
    (raw: number) => {
      if (typeof window === 'undefined') return;
      const el = scrollRegionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollTop = window.scrollY || window.pageYOffset || 0;
      const regionTop = scrollTop + rect.top;
      const viewportHeight = window.innerHeight || 1;
      const maxScroll = Math.max(1, scrollRegionHeightPx - viewportHeight);
      const clamped = Math.max(0, Math.min(1, raw));
      const target = regionTop + clamped * maxScroll;
      window.scrollTo({ top: target });
    },
    [scrollRegionHeightPx, scrollRegionRef],
  );

  const getGlobalProgress = useCallback(() => progressRef.current, []);
  const getRawProgress = useCallback(() => rawProgressRef.current, []);

  /**
   * Directly write raw progress into refs without a scroll event.
   * Safe to call from the RAF loop — does not trigger a React state update
   * (setProgress is intentionally omitted here) so there is no extra render.
   * The React-visible `progress` state is updated on the next genuine scroll
   * or resize event. The Three.js loop reads via getGlobalProgress() which
   * reads progressRef directly, so rendering stays correct immediately.
   */
  const forceRawProgress = useCallback(
    (raw: number) => {
      const clamped = Math.max(0, Math.min(1, raw));
      rawProgressRef.current = clamped;
      const mapped = progressMapper ? progressMapper.remap(clamped) : clamped;
      progressRef.current = mapped;
      // Update React state so UI components reading `progress` stay in sync.
      setProgress(mapped);
    },
    [progressMapper],
  );

  return { progress, scrollToProgress, getGlobalProgress, getRawProgress, scrollToRawProgress, forceRawProgress };
};
