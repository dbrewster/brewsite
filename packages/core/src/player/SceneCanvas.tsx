// Renders the <canvas> element for the engine. Owns registration with the engine
// via setCanvasRef and the ResizeObserver that drives setViewportSize.
// Place as a sibling of EngineOverlayHost inside a position:relative container.

import { forwardRef, useEffect, useRef, type ReactElement, type CanvasHTMLAttributes } from 'react';
import React from 'react';
import { useSceneEngineContext } from './EngineContext';

export interface SceneCanvasProps extends CanvasHTMLAttributes<HTMLCanvasElement> {
  /**
   * Optional React content to display while assets are loading (tickIndex < 0).
   * Rendered as a sibling absolutely positioned over the canvas.
   */
  placeholder?: ReactElement;
}

export const SceneCanvas = forwardRef<HTMLCanvasElement, SceneCanvasProps>(
  function SceneCanvas({ placeholder, style, ...rest }, forwardedRef) {
    const engine = useSceneEngineContext();
    const internalRef = useRef<HTMLCanvasElement>(null);

    // Register/unregister canvas with engine
    useEffect(() => {
      const el = internalRef.current;
      if (!el) return;
      engine.setCanvasRef(el);
      return () => { engine.setCanvasRef(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [engine.setCanvasRef]);

    // Forward external ref
    useEffect(() => {
      if (!forwardedRef) return;
      if (typeof forwardedRef === 'function') {
        forwardedRef(internalRef.current);
        return () => { forwardedRef(null); };
      }
      (forwardedRef as React.MutableRefObject<HTMLCanvasElement | null>).current =
        internalRef.current;
      return () => {
        (forwardedRef as React.MutableRefObject<HTMLCanvasElement | null>).current = null;
      };
    }, [forwardedRef]);

    // ResizeObserver drives engine.setViewportSize — moved here from EngineInputRegion
    useEffect(() => {
      const el = internalRef.current;
      if (!el) return;

      const update = () => {
        const rect = el.getBoundingClientRect();
        engine.setViewportSize(rect.width, rect.height);
      };
      update(); // initialize immediately

      let observer: ResizeObserver | null = null;
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(update);
        observer.observe(el);
      }
      window.addEventListener('resize', update, { passive: true });

      return () => {
        observer?.disconnect();
        window.removeEventListener('resize', update);
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [engine.setViewportSize]);

    const isLoading = engine.frameState.tickIndex < 0;

    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
        <canvas
          ref={internalRef}
          tabIndex={-1}
          style={{ display: 'block', width: '100%', height: '100%' }}
          {...rest}
        />
        {isLoading && placeholder && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {placeholder}
          </div>
        )}
      </div>
    );
  },
);
