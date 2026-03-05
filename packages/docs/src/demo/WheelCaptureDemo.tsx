// Wheel event interception with boundary pass-through and ctrlKey guard.

import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { normalizeDelta } from './normalizeDelta';
import type { DemoCaptureContextValue } from './DemoCaptureContext';

interface WheelCaptureDemoProps {
  /** Children rendered inside the interception container. */
  children: ReactNode;
  /** When true, wheel events are intercepted (demo pointer is inside). */
  active: boolean;
  /** Capture context from the parent DocsDemo. */
  captureCtx: DemoCaptureContextValue;
}

/**
 * Wheel event interception container.
 *
 * When `active`, attaches a non-passive `wheel` listener to its container div.
 * Applies three guards before intercepting:
 *
 * 1. ctrlKey guard — browser zoom, never intercept.
 * 2. Boundary pass-through — at progress 0.0 scrolling up: pass through.
 *    At progress 1.0 scrolling down: pass through (momentum bleed-through).
 * 3. Intercept — call captureCtx.onWheelDelta() with the normalized pixel delta.
 *
 * This is a private component; it is not exported from the package index.
 */
export function WheelCaptureDemo({
  children,
  active,
  captureCtx,
}: WheelCaptureDemoProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (event: WheelEvent): void => {
      // 1. Never intercept Ctrl+Wheel — browser zoom.
      if (event.ctrlKey) return;

      const delta = normalizeDelta(event);
      const progress = captureCtx.getProgress();

      // 2. Boundary pass-through:
      //    At the start (progress 0) scrolling up — let page scroll.
      if (delta < 0 && progress <= 0) return;
      //    At the end (progress 1) scrolling down — let page scroll (momentum bleed).
      if (delta > 0 && progress >= 1) return;

      // 3. Intercept and advance demo progress.
      event.preventDefault();
      captureCtx.onWheelDelta(delta);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [active, captureCtx]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      {children}
    </div>
  );
}
