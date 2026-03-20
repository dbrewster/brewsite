// Renders the <canvas> element for the engine. Owns registration with the engine
// via setCanvasRef and the ResizeObserver that drives setViewportSize.
// Place as a sibling of EngineOverlayHost inside a position:relative container.

import {
  forwardRef,
  useContext,
  useEffect,
  useRef,
  type ReactElement,
  type CanvasHTMLAttributes,
} from 'react';
import React from 'react';
import { EngineContext } from './EngineContext';
import { getCanvasBinding } from './ScenePlayerRegistry';

export interface SceneCanvasProps extends CanvasHTMLAttributes<HTMLCanvasElement> {
  /**
   * Optional React content to display while assets are loading (tickIndex < 0).
   * Rendered as a sibling absolutely positioned over the canvas.
   */
  placeholder?: ReactElement;

  /**
   * Bind this canvas to a named engine when SceneCanvas is not a descendant of
   * the target SceneEngine. Reads from ScenePlayerRegistry by id.
   * For standard usage (canvas inside engine provider), omit this prop.
   */
  engineId?: string;
}

export const SceneCanvas = forwardRef<HTMLCanvasElement, SceneCanvasProps>(
  function SceneCanvas({ placeholder, style, engineId, ...rest }, forwardedRef) {
    // Always call useContext unconditionally — returns null when outside SceneEngine.
    // When engineId is set, localEngine may be null (canvas is outside the engine subtree).
    const localEngine = useContext(EngineContext);
    const internalRef = useRef<HTMLCanvasElement>(null);

    // Throw at render time if neither engineId nor a local engine context is available.
    if (!engineId && !localEngine) {
      throw new Error(
        '[SceneCanvas] must be used inside a <SceneEngine> or with an `engineId` prop.',
      );
    }

    // Register/unregister canvas with engine
    useEffect(() => {
      const el = internalRef.current;
      if (!el) return;

      if (engineId) {
        let rafId: number;
        let retries = 0;
        const MAX_RETRIES = 300; // ~5 seconds at 60fps
        const tryBind = () => {
          const binding = getCanvasBinding(engineId);
          if (binding) {
            binding.setCanvasRef(el);
          } else if (retries < MAX_RETRIES) {
            retries++;
            rafId = requestAnimationFrame(tryBind);
          } else {
            console.warn(
              `[SceneCanvas] Engine "${engineId}" not found after ${MAX_RETRIES} frames (~5s). ` +
              `Verify the engine with this ID is mounted and its engineId prop matches.`,
            );
          }
        };
        rafId = requestAnimationFrame(tryBind);
        return () => {
          cancelAnimationFrame(rafId);
          const binding = getCanvasBinding(engineId);
          binding?.setCanvasRef(null);
        };
      }

      localEngine!.setCanvasRef(el);
      return () => { localEngine!.setCanvasRef(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [engineId, localEngine?.setCanvasRef]);

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

    // ResizeObserver drives setViewportSize
    useEffect(() => {
      const el = internalRef.current;
      if (!el) return;

      const update = () => {
        const rect = el.getBoundingClientRect();
        if (engineId) {
          const binding = getCanvasBinding(engineId);
          binding?.setViewportSize(rect.width, rect.height);
        } else {
          localEngine?.setViewportSize(rect.width, rect.height);
        }
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
    }, [engineId, localEngine?.setViewportSize]);

    const isLoading = localEngine ? localEngine.frameState.tickIndex < 0 : false;

    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
        <canvas
          ref={internalRef}
          tabIndex={-1}
          style={{ display: 'block', width: '100%', height: '100%'}}
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
