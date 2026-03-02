import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { SceneProgressMapper } from './SceneProgressMapper';
import type { ScrollSource } from './engineTypes';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

type ScrollMetrics = {
  sourceScrollTop: number;
  viewportHeight: number;
  regionTop: number;
  maxScroll: number;
};

export type UseEngineScrollOptions = {
  scrollRegionRef: RefObject<HTMLElement | null>;
  scrollRegionHeightPx: number;
  scrollSource?: ScrollSource;
  /**
   * Optional progress mapper. When provided, raw scroll progress is remapped
   * to engine progress via the mapper's remap() method, and scrollToProgress()
   * inverts through the mapper before setting the scroll position.
   * Null means identity mapping (no remapping).
   */
  progressMapper?: SceneProgressMapper | null;
  /**
   * Called when a genuine user scroll event fires (NOT when auto-advance calls
   * scrollTo). Used by useSceneEngine to update per-scene pause-on-scroll state.
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
   * Advances scroll to the position corresponding to the given raw progress value.
   * Bypasses the mapper entirely — raw input space, not engine progress space.
   * Used by auto-advance to avoid the raw→engine→raw round-trip through the mapper.
   */
  scrollToRawProgress(raw: number): void;
  /**
   * Directly writes the given raw progress value into rawProgressRef and
   * progressRef WITHOUT calling scrollTo or firing any scroll event.
   *
   * Used by the auto-advance state machine to synchronize the scroll-derived
   * refs when auto-advance stops.
   */
  forceRawProgress(raw: number): void;
};

export const useEngineScroll = (options: UseEngineScrollOptions): UseEngineScrollResult => {
  const { scrollRegionRef, scrollRegionHeightPx, progressMapper } = options;
  const scrollSource = options.scrollSource ?? 'window';
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const rawProgressRef = useRef(0);

  const resolveWindowMetrics = useCallback((): ScrollMetrics | null => {
    if (typeof window === 'undefined') return null;
    const el = scrollRegionRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const scrollTop = window.scrollY || window.pageYOffset || 0;
    const regionTop = scrollTop + rect.top;
    const viewportHeight = window.innerHeight || 1;
    const maxScroll = Math.max(1, scrollRegionHeightPx - viewportHeight);
    return { sourceScrollTop: scrollTop, viewportHeight, regionTop, maxScroll };
  }, [scrollRegionHeightPx, scrollRegionRef]);

  const resolveElementMetrics = useCallback((source: HTMLElement): ScrollMetrics | null => {
    const region = scrollRegionRef.current;
    if (!region) return null;
    const sourceRect = source.getBoundingClientRect();
    const regionRect = region.getBoundingClientRect();
    const sourceScrollTop = source.scrollTop;
    const regionTop = sourceScrollTop + (regionRect.top - sourceRect.top);
    const viewportHeight = source.clientHeight || 1;
    const maxScroll = Math.max(1, scrollRegionHeightPx - viewportHeight);
    return { sourceScrollTop, viewportHeight, regionTop, maxScroll };
  }, [scrollRegionHeightPx, scrollRegionRef]);

  const resolveMetrics = useCallback((): ScrollMetrics | null => {
    if (scrollSource === 'window') {
      return resolveWindowMetrics();
    }
    const source = scrollSource.elementRef.current;
    if (!source) return null;
    return resolveElementMetrics(source);
  }, [scrollSource, resolveWindowMetrics, resolveElementMetrics]);

  const computeProgress = useCallback((): { raw: number; mapped: number } => {
    const metrics = resolveMetrics();
    if (!metrics) {
      return { raw: rawProgressRef.current, mapped: progressRef.current };
    }
    const raw = clamp01((metrics.sourceScrollTop - metrics.regionTop) / metrics.maxScroll);
    const mapped = progressMapper ? progressMapper.remap(raw) : raw;
    return { raw, mapped };
  }, [resolveMetrics, progressMapper]);

  const update = useCallback(() => {
    const { raw, mapped } = computeProgress();
    if (Math.abs(mapped - progressRef.current) < 1e-5 && Math.abs(raw - rawProgressRef.current) < 1e-5) return;
    rawProgressRef.current = raw;
    progressRef.current = mapped;
    setProgress(mapped);
  }, [computeProgress]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let rafId = 0;
    const refreshUntilSourceReady = () => {
      if (scrollSource === 'window') return;
      if (!scrollSource.elementRef.current) {
        rafId = window.requestAnimationFrame(refreshUntilSourceReady);
        return;
      }
      update();
    };

    update();
    refreshUntilSourceReady();

    const onResize = () => update();
    const onWindowScroll = () => {
      update();
      options.onUserScroll?.();
    };
    const onElementScroll = (event: Event) => {
      if (scrollSource === 'window') return;
      const source = scrollSource.elementRef.current;
      if (!source || event.target !== source) return;
      update();
      options.onUserScroll?.();
    };

    if (scrollSource === 'window') {
      window.addEventListener('scroll', onWindowScroll, { passive: true });
    } else {
      document.addEventListener('scroll', onElementScroll, { passive: true, capture: true });
    }
    window.addEventListener('resize', onResize);

    return () => {
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
      if (scrollSource === 'window') {
        window.removeEventListener('scroll', onWindowScroll);
      } else {
        document.removeEventListener('scroll', onElementScroll, true);
      }
      window.removeEventListener('resize', onResize);
    };
    // options.onUserScroll intentionally excluded: callback-ref pattern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollSource, update]);

  const scrollToWithRaw = useCallback((rawTarget: number) => {
    const metrics = resolveMetrics();
    if (!metrics) return;
    const target = metrics.regionTop + clamp01(rawTarget) * metrics.maxScroll;
    if (scrollSource === 'window') {
      window.scrollTo({ top: target });
      return;
    }
    const source = scrollSource.elementRef.current;
    source?.scrollTo({ top: target });
  }, [resolveMetrics, scrollSource]);

  const scrollToProgress = useCallback((next: number) => {
    const rawTarget = progressMapper ? progressMapper.inverse(clamp01(next)) : clamp01(next);
    scrollToWithRaw(rawTarget);
  }, [progressMapper, scrollToWithRaw]);

  const scrollToRawProgress = useCallback((raw: number) => {
    scrollToWithRaw(raw);
  }, [scrollToWithRaw]);

  const getGlobalProgress = useCallback(() => progressRef.current, []);
  const getRawProgress = useCallback(() => rawProgressRef.current, []);

  const forceRawProgress = useCallback((raw: number) => {
    const clamped = clamp01(raw);
    rawProgressRef.current = clamped;
    const mapped = progressMapper ? progressMapper.remap(clamped) : clamped;
    progressRef.current = mapped;
    setProgress(mapped);
  }, [progressMapper]);

  return { progress, scrollToProgress, getGlobalProgress, getRawProgress, scrollToRawProgress, forceRawProgress };
};
