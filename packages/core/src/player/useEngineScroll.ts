import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export type UseEngineScrollOptions = {
  scrollRegionRef: RefObject<HTMLElement | null>;
  scrollRegionHeightPx: number;
};

export type UseEngineScrollResult = {
  progress: number;
  scrollToProgress: (next: number) => void;
  getGlobalProgress: () => number;
};

export const useEngineScroll = (options: UseEngineScrollOptions): UseEngineScrollResult => {
  const { scrollRegionRef, scrollRegionHeightPx } = options;
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);

  const computeProgress = useCallback((): number => {
    if (typeof window === 'undefined') return 0;
    const el = scrollRegionRef.current;
    if (!el) return 0;

    const rect = el.getBoundingClientRect();
    const scrollTop = window.scrollY || window.pageYOffset || 0;
    const regionTop = scrollTop + rect.top;
    const viewportHeight = window.innerHeight || 1;
    const maxScroll = Math.max(1, scrollRegionHeightPx - viewportHeight);
    return clamp01((scrollTop - regionTop) / maxScroll);
  }, [scrollRegionHeightPx, scrollRegionRef]);

  const update = useCallback(() => {
    const next = computeProgress();
    if (Math.abs(next - progressRef.current) < 1e-5) return;
    progressRef.current = next;
    setProgress(next);
  }, [computeProgress]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    update();
    const onScroll = () => update();
    const onResize = () => update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
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
      const target = regionTop + clamp01(next) * maxScroll;
      window.scrollTo({ top: target });
    },
    [scrollRegionHeightPx, scrollRegionRef],
  );

  const getGlobalProgress = useCallback(() => progressRef.current, []);

  return { progress, scrollToProgress, getGlobalProgress };
};
