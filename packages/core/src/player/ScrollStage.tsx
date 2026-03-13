// ScrollStage.tsx — Contained native scroll container for sticky-canvas playback.

import {
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useSceneEngineContext } from './EngineContext';
import { ScrollRegionContext } from './ScrollRegionContext';
import { ViewportScaleContext } from './EngineARContainer';
import { ScrollNavigatorContext } from './ScrollNavigatorContext';
import { ScrollDriverContext } from './ScrollDriverContext';
import type { IScrollSource } from './scrollSourceTypes';
import { clamp01 } from '../math';

export interface ScrollStageProps {
  /**
   * How scroll region height is computed.
   * 'scene-count'  — height = pixelsPerScene × sceneCount (default)
   * 'scroll-units' — height = totalScrollUnits × pixelsPerScrollUnit
   */
  scrollHeightMode?: 'scene-count' | 'scroll-units';

  /** Pixels per scene when scrollHeightMode='scene-count'. Default: 1200. */
  pixelsPerScene?: number;

  /** Pixels per scroll unit when scrollHeightMode='scroll-units'. Default: 1. */
  pixelsPerScrollUnit?: number;

  /**
   * Exact scroll region height in pixels. Overrides all automatic calculation.
   * Use when an external system must stay in sync with the stage's native scroll position.
   */
  scrollHeightPx?: number;

  /**
   * Optional explicit height for the sticky viewport region.
   * When omitted, ScrollStage measures its own host height and uses that.
   */
  stageHeight?: string | number;

  className?: string;
  style?: CSSProperties;
  stageClassName?: string;
  stageStyle?: CSSProperties;
  children: ReactNode;
}

export interface ScrollStageSnapshot {
  readonly scrollTop: number;
  readonly maxScrollTop: number;
  readonly rawProgress: number;
}

export interface ScrollStageHandle {
  getElement(): HTMLDivElement | null;
  getSnapshot(): ScrollStageSnapshot;
  getScrollTop(): number;
  getMaxScrollTop(): number;
  getRawProgress(): number;
  scrollToPx(top: number, behavior?: ScrollBehavior): void;
  scrollToProgress(rawProgress: number, behavior?: ScrollBehavior): void;
  subscribe(listener: (snapshot: ScrollStageSnapshot) => void): () => void;
}

/**
 * ScrollStage — contained native scroll container for scene playback.
 * Renders a sized scroll host that owns native scrolling, a tall spacer div that
 * defines the scroll range, and a sticky inner stage that stays pinned while the
 * container scrolls. The host provides scroll overflow defaults but does not
 * impose any outer layout policy beyond filling its parent box. Child scroll
 * source components may override the native stage scroll driver.
 */
export const ScrollStage = forwardRef<ScrollStageHandle, ScrollStageProps>(
  function ScrollStage(props, forwardedRef): ReactElement {
    const engine = useSceneEngineContext();
    const arCtx = useContext(ViewportScaleContext);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const subscribersRef = useRef(new Set<(snapshot: ScrollStageSnapshot) => void>());
    const [customSource, setCustomSource] = useState<IScrollSource | null>(null);
    const rawProgressRef = useRef(0);
    const [viewportHeightPx, setViewportHeightPx] = useState(0);

    // ─── Scroll region height computation ────────────────────────────────────
    const scrollRegionHeightPx = useMemo((): number => {
      if (props.scrollHeightPx != null) return props.scrollHeightPx;

      if (props.scrollHeightMode === 'scroll-units') {
        const totalScrollUnits = engine.sceneTrack?.progressProfile?.totalScrollUnits ?? 0;
        const ppu = props.pixelsPerScrollUnit ?? 1;
        return totalScrollUnits * ppu;
      }

      const pps = props.pixelsPerScene ?? 1200;
      return pps * Math.max(1, engine.sceneCount);
    }, [
      props.scrollHeightPx,
      props.scrollHeightMode,
      props.pixelsPerScrollUnit,
      props.pixelsPerScene,
      engine.sceneTrack,
      engine.sceneCount,
    ]);

    const getSnapshot = (): ScrollStageSnapshot => {
      const element = containerRef.current;
      const viewportHeight = element?.clientHeight ?? viewportHeightPx;
      const maxScrollTop = Math.max(0, scrollRegionHeightPx - viewportHeight);
      const scrollTop = customSource
        ? clamp01(rawProgressRef.current) * maxScrollTop
        : (element?.scrollTop ?? 0);
      return {
        scrollTop,
        maxScrollTop,
        rawProgress: customSource
          ? clamp01(rawProgressRef.current)
          : (maxScrollTop <= 0 ? 0 : clamp01(scrollTop / maxScrollTop)),
      };
    };

    const emitSnapshot = (): void => {
      const snapshot = getSnapshot();
      subscribersRef.current.forEach((listener) => listener(snapshot));
    };

    useEffect(() => {
      const element = containerRef.current;
      if (!element) return;

      const updateViewportHeight = () => {
        setViewportHeightPx(element.clientHeight);
        emitSnapshot();
      };

      updateViewportHeight();

      if (typeof ResizeObserver === 'undefined') {
        window.addEventListener('resize', updateViewportHeight, { passive: true });
        return () => window.removeEventListener('resize', updateViewportHeight);
      }

      const observer = new ResizeObserver(() => updateViewportHeight());
      observer.observe(element);
      return () => observer.disconnect();
    }, [scrollRegionHeightPx]);

    useEffect(() => {
      const element = containerRef.current;
      if (!element) return;
      const handleScroll = () => {
        if (!customSource) {
          const maxScrollTop = Math.max(0, scrollRegionHeightPx - element.clientHeight);
          rawProgressRef.current = maxScrollTop <= 0 ? 0 : clamp01(element.scrollTop / maxScrollTop);
          engine.setRawProgress(rawProgressRef.current);
        }
        emitSnapshot();
      };
      element.addEventListener('scroll', handleScroll, { passive: true });
      emitSnapshot();
      return () => element.removeEventListener('scroll', handleScroll);
    }, [customSource, engine, scrollRegionHeightPx, viewportHeightPx]);

    useEffect(() => {
      if (customSource) return;
      const element = containerRef.current;
      if (!element) return;
      const viewportHeight = element.clientHeight;
      const maxScrollTop = Math.max(0, scrollRegionHeightPx - viewportHeight);
      const rawProgress = maxScrollTop <= 0 ? 0 : clamp01(element.scrollTop / maxScrollTop);
      rawProgressRef.current = rawProgress;
      engine.setRawProgress(rawProgress);
      emitSnapshot();
    }, [customSource, engine, scrollRegionHeightPx, viewportHeightPx]);

    useEffect(() => {
      if (!customSource) return;
      const unsubscribe = customSource.subscribe((rawProgress) => {
        rawProgressRef.current = clamp01(rawProgress);
        engine.setRawProgress(rawProgressRef.current);
        emitSnapshot();
      });
      return unsubscribe;
    }, [customSource, engine]);

    // ─── Sticky stage height ──────────────────────────────────────────────────
    const stickyHeight: string =
      typeof props.stageHeight === 'number'
        ? `${props.stageHeight}px`
        : typeof props.stageHeight === 'string'
          ? props.stageHeight
          : arCtx.computedArHeight > 0
            ? `${arCtx.computedArHeight}px`
            : viewportHeightPx > 0
              ? `${viewportHeightPx}px`
              : '100%';

    // ─── ScrollRegionContext provision ───────────────────────────────────────
    const scrollRegionContextValue = useMemo(
      () => ({ containerRef, scrollHeightPx: scrollRegionHeightPx }),
      [scrollRegionHeightPx],
    );

    const scrollNavigatorValue = useMemo(() => ({
      scrollTo: (rawProgress: number) => {
        if (customSource?.scrollTo) {
          customSource.scrollTo(clamp01(rawProgress));
          return;
        }
        const container = containerRef.current;
        if (!container) return;
        const maxScrollTop = Math.max(0, scrollRegionHeightPx - container.clientHeight);
        container.scrollTo({ top: clamp01(rawProgress) * maxScrollTop, behavior: 'smooth' });
      },
    }), [customSource, scrollRegionHeightPx]);

    const scrollDriverContextValue = useMemo(
      () => ({ setSource: setCustomSource }),
      [],
    );

    useImperativeHandle(forwardedRef, (): ScrollStageHandle => ({
      getElement: () => containerRef.current,
      getSnapshot,
      getScrollTop: () => getSnapshot().scrollTop,
      getMaxScrollTop: () => getSnapshot().maxScrollTop,
      getRawProgress: () => getSnapshot().rawProgress,
      scrollToPx: (top: number, behavior: ScrollBehavior = 'auto') => {
        if (customSource?.scrollTo) {
          const { maxScrollTop } = getSnapshot();
          customSource.scrollTo(maxScrollTop <= 0 ? 0 : clamp01(top / maxScrollTop));
          return;
        }
        containerRef.current?.scrollTo({ top, behavior });
      },
      scrollToProgress: (rawProgress: number, behavior: ScrollBehavior = 'auto') => {
        if (customSource?.scrollTo) {
          customSource.scrollTo(clamp01(rawProgress));
          return;
        }
        const { maxScrollTop } = getSnapshot();
        containerRef.current?.scrollTo({
          top: clamp01(rawProgress) * maxScrollTop,
          behavior,
        });
      },
      subscribe: (listener: (snapshot: ScrollStageSnapshot) => void) => {
        subscribersRef.current.add(listener);
        listener(getSnapshot());
        return () => subscribersRef.current.delete(listener);
      },
    }), [customSource, scrollRegionHeightPx, viewportHeightPx]);

    return (
      <ScrollDriverContext.Provider value={scrollDriverContextValue}>
        <ScrollRegionContext.Provider value={scrollRegionContextValue}>
          <ScrollNavigatorContext.Provider value={scrollNavigatorValue}>
            <div
              ref={containerRef}
              className={props.className}
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                minWidth: 0,
                minHeight: 0,
                overflowY: customSource ? 'hidden' : 'auto',
                overflowX: 'hidden',
                overscrollBehavior: 'none',
                ...props.style,
              }}
            >
              <div
                style={{
                  position: 'relative',
                  minHeight: scrollRegionHeightPx,
                }}
              >
                <div
                  className={props.stageClassName}
                  style={{
                    position: 'sticky',
                    top: 0,
                    width: '100%',
                    height: stickyHeight,
                    overflow: 'hidden',
                    outline: 'none',
                    ...props.stageStyle,
                  }}
                >
                  {props.children}
                </div>
              </div>
            </div>
          </ScrollNavigatorContext.Provider>
        </ScrollRegionContext.Provider>
      </ScrollDriverContext.Provider>
    );
  },
);
