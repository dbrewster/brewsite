// Viewport container for the scene engine. Supports scroll and direct input modes.

import { useEffect, useRef } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { UseSceneEngineResult } from './useSceneEngine';
import type { SceneNavInputMap } from '../input/types';

export type EngineInputRegionProps = {
  engine: UseSceneEngineResult;
  inputMap?: SceneNavInputMap;
  className?: string;
  children?: ReactNode;
};

export const EngineInputRegion = ({
  engine,
  inputMap,
  className,
  children,
}: EngineInputRegionProps): ReactElement => {
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const mode = inputMap?.mode ?? 'scroll';

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
        height: '100vh',
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
      <div ref={engine.scrollRegionRef} className={className} style={{ position: 'relative', height: '100vh' }}>
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
