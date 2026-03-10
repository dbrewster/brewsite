// ScrollStage.tsx — DOM layout helper for full-page sticky-canvas scroll pattern.
// Creates the tall outer spacer div and the position:sticky inner stage.
// Provides ScrollRegionContext for ScrollInput source='window'.

import {
  useContext,
  useMemo,
  useRef,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useSceneEngineContext } from './EngineContext';
import { ScrollRegionContext } from './ScrollRegionContext';
import { ViewportScaleContext } from './EngineARContainer';

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
   * Use when an external system must stay in sync with window.scrollY.
   */
  scrollHeightPx?: number;

  /**
   * CSS height of the sticky stage. Default: '100vh'.
   * Set to a pixel value for fixed-parent-height embedding.
   */
  stageHeight?: string | number;

  className?: string;
  stageClassName?: string;
  children: ReactNode;
}

/**
 * ScrollStage — DOM layout helper for the full-page sticky-canvas scroll pattern.
 * Renders a tall outer spacer div (scroll region) and a position:sticky inner stage.
 * Does not attach scroll listeners — that is ScrollInput's responsibility.
 * Does not provide the background div — use BackgroundLayer as a child.
 */
export function ScrollStage(props: ScrollStageProps): ReactElement {
  const engine = useSceneEngineContext();
  const arCtx = useContext(ViewportScaleContext);

  // ─── Scroll region height computation ──────────────────────────────────────
  const scrollRegionHeightPx = useMemo((): number => {
    // 1. Explicit override takes priority
    if (props.scrollHeightPx != null) return props.scrollHeightPx;

    // 2. Scroll-units mode: read from compiled track's progressProfile
    if (props.scrollHeightMode === 'scroll-units') {
      const totalScrollUnits = engine.sceneTrack?.progressProfile?.totalScrollUnits ?? 0;
      const ppu = props.pixelsPerScrollUnit ?? 1;
      return totalScrollUnits * ppu;
    }

    // 3. Scene-count mode (default): pixels per scene × scene count
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

  // ─── Sticky stage height ────────────────────────────────────────────────────
  const stickyHeight: string =
    arCtx.computedArHeight > 0
      ? `${arCtx.computedArHeight}px`
      : typeof props.stageHeight === 'number'
        ? `${props.stageHeight}px`
        : (props.stageHeight ?? '100vh');

  // ─── ScrollRegionContext provision ─────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollRegionContextValue = useMemo(
    () => ({ containerRef, scrollHeightPx: scrollRegionHeightPx }),
    [scrollRegionHeightPx],
  );

  return (
    <ScrollRegionContext.Provider value={scrollRegionContextValue}>
      {/* Tall outer div — the scroll spacer */}
      <div
        ref={containerRef}
        className={props.className}
        style={{
          position: 'relative',
          height: scrollRegionHeightPx,
          overscrollBehavior: 'none',
        }}
      >
        {/* Sticky inner stage */}
        <div
          className={props.stageClassName}
          style={{
            position: 'sticky',
            top: 0,
            width: '100%',
            height: stickyHeight,
            overflow: 'hidden',
            outline: 'none',
          }}
        >
          {props.children}
        </div>
      </div>
    </ScrollRegionContext.Provider>
  );
}
