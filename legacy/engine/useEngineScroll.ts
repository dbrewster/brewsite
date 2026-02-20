import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { clamp01 } from '../robotTimelineMath';
import { EngineScrollRegion } from './EngineScrollRegion';
import { DEFAULT_PIXELS_PER_SCENE } from './engineTypes';

export type UseEngineScrollOptions = {
  sceneCount: number;
  subTickCount: number;
  pixelsPerScene?: number;
  mainRef: RefObject<HTMLElement | null>;
};

export type UseEngineScrollResult = {
  scrollRegionRef: RefObject<HTMLDivElement | null>;
  /** Reads scrollTop directly from the DOM — zero React state lag, used by RAF loop. */
  getGlobalProgress: () => number;
  /** React state — updated by passive scroll listener at RAF rate, used for UI display. */
  progress: number;
  scrollToProgress: (next: number) => void;
  /** Height for the ScrollRegion spacer div: viewportHeight + sceneCount * pixelsPerScene. */
  scrollRegionHeightPx: number;
};

export const useEngineScroll = ({
  sceneCount,
  subTickCount,
  pixelsPerScene = DEFAULT_PIXELS_PER_SCENE,
  mainRef,
}: UseEngineScrollOptions): UseEngineScrollResult => {
  const scrollRegionRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window !== 'undefined' ? (window.visualViewport?.height ?? window.innerHeight) : 800,
  );

  const scrollRegionRef_ = useRef(
    new EngineScrollRegion({ sceneCount, subTickCount, pixelsPerScene }),
  );

  useEffect(() => {
    scrollRegionRef_.current = new EngineScrollRegion({ sceneCount, subTickCount, pixelsPerScene });
  }, [sceneCount, subTickCount, pixelsPerScene]);

  const scrollRegionHeightPx = scrollRegionRef_.current.getScrollRegionHeightPx(viewportHeight);

  // Track viewport height so the scroll spacer stays correctly sized.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => {
      setViewportHeight(window.visualViewport?.height ?? window.innerHeight);
    };
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  const getScrollContainer = useCallback((): Element | null => {
    if (typeof document === 'undefined') return null;
    const main = mainRef.current;
    if (main && typeof window !== 'undefined') {
      const overflowY = window.getComputedStyle(main).overflowY;
      const isScrollable = overflowY !== 'visible' && overflowY !== 'hidden';
      if (isScrollable && main.scrollHeight - main.clientHeight > 2) return main;
    }
    return document.scrollingElement;
  }, [mainRef]);

  // Direct DOM read — no React lag. This is the function passed to RuntimeLoop.
  const getGlobalProgress = useCallback((): number => {
    const container = getScrollContainer();
    if (!container) return 0;
    const maxScroll = container.scrollHeight - container.clientHeight;
    if (maxScroll <= 0) return 0;
    return clamp01(container.scrollTop / maxScroll);
  }, [getScrollContainer]);

  // Passive scroll listener — updates React state for scrubber display and background CSS.
  useEffect(() => {
    const target = getScrollContainer();
    if (!target) return;
    let raf = 0;
    const handleScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const maxScroll = target.scrollHeight - target.clientHeight;
        if (maxScroll <= 0) return;
        setProgress(clamp01(target.scrollTop / maxScroll));
      });
    };
    const useWindow = target === document.scrollingElement;
    const eventTarget: EventTarget = useWindow ? window : target;
    eventTarget.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      eventTarget.removeEventListener('scroll', handleScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [getScrollContainer]);

  const scrollToProgress = useCallback(
    (next: number) => {
      const container = getScrollContainer();
      if (!container) return;
      const maxScroll = container.scrollHeight - container.clientHeight;
      if (maxScroll <= 0) return;
      container.scrollTo({ top: clamp01(next) * maxScroll, behavior: 'auto' });
    },
    [getScrollContainer],
  );

  return { scrollRegionRef, getGlobalProgress, progress, scrollToProgress, scrollRegionHeightPx };
};
