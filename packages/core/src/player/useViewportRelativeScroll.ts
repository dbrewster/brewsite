// Viewport-relative scroll progress + WebGL context lifecycle for inline ScenePanels.
// Called from SceneEngine when scrollSource.kind === 'viewport-relative'.

import { useEffect, useRef } from 'react';
import type { ViewportRelativeScrollSource } from './engineTypes';

export type UseViewportRelativeScrollOptions = {
  /**
   * The viewport-relative scroll source, or null when the SceneEngine is not
   * in viewport-relative mode. When null, this hook is a no-op.
   */
  source: ViewportRelativeScrollSource | null;
  /**
   * Callback invoked on every window scroll event with the new per-panel progress [0..1].
   * Should be a stable function reference (e.g., created by useCallback or stored in a ref).
   * Bypasses React state to avoid re-renders on every scroll event.
   */
  onProgress: ((progress: number) => void) | null;
};

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

function computePanelProgress(containerEl: HTMLElement): number {
  const panelHeight = containerEl.offsetHeight;
  const viewportH = window.innerHeight;
  const maxScroll = panelHeight - viewportH;
  if (maxScroll <= 0) {
    // Panel shorter than viewport — no traversal window. Always terminal state.
    return 1;
  }
  const panelTop = containerEl.getBoundingClientRect().top + window.scrollY;
  const scrolled = window.scrollY - panelTop;
  return clamp01(scrolled / maxScroll);
}

/**
 * Manages scroll progress and WebGL context lifecycle for a viewport-relative ScenePanel.
 *
 * Scroll progress: passive window scroll listener computes progress and calls onProgress().
 * Context lifecycle: IntersectionObserver (rootMargin: '200px') calls loseContext() on
 * panel exit and restoreContext() on re-entry. RuntimeLoop.pause()/resume() are triggered
 * by the resulting webglcontextlost/webglcontextrestored events on the canvas element.
 *
 * Both effects are no-ops when source === null.
 */
export function useViewportRelativeScroll(options: UseViewportRelativeScrollOptions): void {
  const { source, onProgress } = options;

  // Stable ref to the onProgress callback. Avoids scroll effect re-running
  // when the callback changes identity across renders.
  const onProgressRef = useRef<((p: number) => void) | null>(null);
  onProgressRef.current = onProgress;

  // Hold the WEBGL_lose_context extension across renders so restoreContext()
  // can be called on the same extension object that loseContext() was called on.
  const extRef = useRef<WEBGL_lose_context | null>(null);

  // Tracks whether the panel's context has been acquired at least once.
  // First intersection is a no-op (engine acquires context normally via SceneCanvas).
  // Only subsequent intersections after a deliberate loseContext() call need restoreContext().
  const initializedRef = useRef(false);

  // — Scroll progress listener —————————————————————————————————————————————————
  useEffect(() => {
    const containerRef = source?.containerRef ?? null;
    if (!containerRef) return;

    const onScroll = () => {
      const el = containerRef.current;
      if (!el) return;
      onProgressRef.current?.(computePanelProgress(el));
    };

    const onResize = () => {
      const el = containerRef.current;
      if (!el) return;
      onProgressRef.current?.(computePanelProgress(el));
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    // Compute initial progress synchronously on mount (user may already be scrolled in).
    const el = containerRef.current;
    if (el) onProgressRef.current?.(computePanelProgress(el));

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  // source?.containerRef is a stable RefObject — safe as a dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.containerRef]);

  // — WebGL context lifecycle (IntersectionObserver) ——————————————————————————
  useEffect(() => {
    const canvasRef = source?.canvasRef ?? null;
    if (!canvasRef) return;

    // canvasRef.current is populated by the time this effect runs because
    // SceneCanvas's forwardRef effect runs before SceneEngine's effects
    // (React effects fire children-before-parent).
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;

        if (entry.isIntersecting) {
          if (!initializedRef.current) {
            // First intersection: SceneEngine + SceneCanvas acquire the
            // WebGL context through normal initialization. Nothing to do here.
            initializedRef.current = true;
          } else {
            // Re-entry: context was deliberately lost on exit. Restore it.
            // The webglcontextrestored event fires on the canvas element, which
            // RuntimeLoop listens for via setCanvas() to call resume().
            extRef.current?.restoreContext();
          }
        } else {
          if (initializedRef.current) {
            // Exit: acquire the WEBGL_lose_context extension and explicitly
            // release the GPU slot. The webglcontextlost event fires on the
            // canvas element, which RuntimeLoop listens for via setCanvas()
            // to call pause(). e.preventDefault() in that handler allows
            // subsequent restoration.
            const gl = canvas.getContext('webgl2');
            extRef.current = gl?.getExtension('WEBGL_lose_context') ?? null;
            extRef.current?.loseContext();
          }
        }
      },
      {
        // Start restoration 200px before the panel enters the viewport.
        // This gives the engine time to reinitialize before the canvas is visible.
        rootMargin: '200px',
      },
    );

    observer.observe(canvas);
    return () => observer.disconnect();
  // source?.canvasRef is a stable RefObject — safe as a dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.canvasRef]);
}
