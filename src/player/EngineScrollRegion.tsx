import { useEffect, useRef } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { UseSceneEngineResult } from './useSceneEngine';

export type EngineScrollRegionProps = {
  engine: UseSceneEngineResult;
  className?: string;
  children?: ReactNode;
};

export const EngineScrollRegion = ({ engine, className, children }: EngineScrollRegionProps): ReactElement => {
  const stickyRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <div
      ref={engine.scrollRegionRef}
      className={className}
      style={{ position: 'relative', height: engine.scrollRegionHeightPx, overscrollBehavior: 'none' }}
    >
      <div
        ref={stickyRef}
        style={{
          position: 'sticky',
          top: 0,
          width: '100%',
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        <canvas
          ref={engine.setCanvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
        {children && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
};
