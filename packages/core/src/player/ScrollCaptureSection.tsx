// Player-layer component. No compiler involvement.
// Creates the sticky-capture pattern: tall outer div + sticky inner stage.
// Pushes raw progress [0..1] into the engine via engine.setRawProgress.

import { useRef, useEffect, type ReactNode } from 'react';
import { useSceneEngineContext } from './EngineContext';

export interface ScrollCaptureSectionProps {
  /**
   * Total scroll budget in pixels. Controls how tall the outer div is.
   * Set this to the sum of all <ProgressManager scrollUnits> values
   * in the contained scenes (multiplied by pixelsPerUnit if desired).
   *
   * Example: two scenes with scrollUnits={2400} and scrollUnits={800}
   * → height={3200}
   */
  height: number;

  /**
   * CSS height of the sticky inner stage. Default: '100vh'.
   * Set to a fixed pixel value to embed the canvas at a specific height
   * rather than full-viewport.
   */
  stageHeight?: string | number;

  className?: string;
  stageClassName?: string;
  children: ReactNode;
}

export function ScrollCaptureSection({
  height,
  stageHeight = '100vh',
  className,
  stageClassName,
  children,
}: ScrollCaptureSectionProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const engine = useSceneEngineContext();
  const { setRawProgress } = engine;

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;

    const computeAndSet = () => {
      const rect = outer.getBoundingClientRect();
      // How far we've scrolled into the outer div (negative rect.top = scrolled past top)
      const scrolled = -rect.top;
      // Max scroll is outer height minus one stage height
      const stageH = typeof stageHeight === 'number'
        ? stageHeight
        : window.innerHeight;  // treat '100vh' as window.innerHeight
      const maxScroll = outer.offsetHeight - stageH;
      if (maxScroll <= 0) return;  // outer not tall enough to scroll
      const raw = Math.max(0, Math.min(1, scrolled / maxScroll));
      setRawProgress(raw);
    };

    // Initialize on mount (user may have already scrolled past)
    computeAndSet();

    window.addEventListener('scroll', computeAndSet, { passive: true });
    window.addEventListener('resize', computeAndSet, { passive: true });

    return () => {
      window.removeEventListener('scroll', computeAndSet);
      window.removeEventListener('resize', computeAndSet);
    };
  }, [setRawProgress, stageHeight]);

  return (
    <div ref={outerRef} style={{ height }} className={className}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          height: stageHeight,
          overflow: 'hidden',
        }}
        className={stageClassName}
      >
        {children}
      </div>
    </div>
  );
}
