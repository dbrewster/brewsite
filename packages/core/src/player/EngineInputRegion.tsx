// Viewport container for the scene engine. Supports scroll and direct input modes.

import { useEffect, useRef } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { UseSceneEngineResult } from './useSceneEngine';

export type EngineInputRegionProps = {
  engine: UseSceneEngineResult;
  className?: string;
  children?: ReactNode;
  /**
   * When true, the region renders with `height: 100%` to fill its parent
   * container rather than `100vh`. Use for embedded players (e.g. doc demos)
   * where the parent element provides an explicit height constraint.
   *
   * Requires the parent chain to have an explicit CSS height so that
   * `height: 100%` resolves correctly.
   */
  fillContainer?: boolean;
};

export const EngineInputRegion = ({
  engine,
  className,
  children,
  fillContainer = false,
}: EngineInputRegionProps): ReactElement => {
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const mode = engine.inputMode;
  // When filling a container, use 100% so the parent's explicit height
  // constrains us. Otherwise fall back to 100vh for full-page layouts.
  const viewportFill = fillContainer ? '100%' : '100vh';

  useEffect(() => {
    const el = stickyRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      engine.setViewportSize(rect.width, rect.height);
    };
    update();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => update());
      observer.observe(el);
    }
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [engine.setViewportSize]);

  const innerContent = (
    <div
      ref={stickyRef}
      // tabIndex={-1}: makes the container programmatically focusable so that
      // keyboard events (including the camera reset shortcut 'r') can be
      // received when the element or canvas is clicked. Without this, keydown
      // events attached to this HTMLElement never fire.
      tabIndex={-1}
      onPointerDown={(event) => {
        const el = event.currentTarget as HTMLDivElement;
        if (typeof el.focus === 'function') {
          el.focus();
        }
      }}
      style={{
        position: mode === 'scroll' ? 'sticky' : 'relative',
        top: 0,
        width: '100%',
        height: viewportFill,
        overflow: 'hidden',
        outline: 'none',
      }}
    >
      <div
        ref={engine.setBackgroundRef}
        style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundPosition: 'center', backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat', pointerEvents: 'none',
        }}
      />
      <canvas
        ref={engine.setCanvasRef}
        tabIndex={-1}
        style={{ width: '100%', height: '100%', display: 'block', position: 'relative', zIndex: 1 }}
      />
      {children && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
          {children}
        </div>
      )}
    </div>
  );

  if (mode === 'direct') {
    return (
      <div ref={engine.scrollRegionRef} className={className} style={{ position: 'relative', height: viewportFill }}>
        {innerContent}
      </div>
    );
  }

  // Scroll mode: tall spacer creates the scrollable space
  return (
    <div
      ref={engine.scrollRegionRef}
      className={className}
      style={{ position: 'relative', height: engine.scrollRegionHeightPx, overscrollBehavior: 'none' }}
    >
      {innerContent}
    </div>
  );
};
