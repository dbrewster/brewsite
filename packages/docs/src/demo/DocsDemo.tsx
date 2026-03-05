// Demo container: lazy-mounts DemoEngine on intersection, captures wheel scroll.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import { DemoCaptureContext, type DemoCaptureContextValue } from './DemoCaptureContext';
import { WheelCaptureDemo } from './WheelCaptureDemo';

/**
 * Props for DocsDemo.
 */
export interface DocsDemoProps {
  /**
   * Scroll budget in scroll units (1 unit = 1 normalized pixel of deltaY).
   * Determines how much wheel scrolling advances the demo from 0→1.
   * Required. Recommend 2400 as a default value in author-facing docs.
   */
  scrollUnits: number;
  /**
   * Height of the demo container in the page flow.
   *
   * number → treated as pixels. `height={480}` → CSS `height: 480px`.
   * string → passed directly as a CSS length. `height="100vh"` or `height="50vh"`.
   *
   * REQUIREMENT: Both the placeholder div (when unmounted) and the mounted
   * container receive this exact value. They must render at the same pixel
   * height so hash navigation to sections below the demo lands correctly.
   *
   * SAFE: viewport-relative units (`vh`, `dvh`), fixed pixels (`px`).
   * UNSAFE: `calc()` expressions that depend on sibling layout (e.g., `calc(100% - 60px)`)
   * where `100%` resolves differently in placeholder vs mounted state. Document this
   * constraint clearly in usage examples.
   */
  height: number | string;
  /** Optional title displayed above the demo canvas. */
  title?: string;
  /**
   * Demo content — must include a DemoEngine with its children.
   * Example:
   * ```tsx
   * <DocsDemo scrollUnits={2400} height={480}>
   *   <MyDemo />   // MyDemo wraps DemoEngine
   * </DocsDemo>
   * ```
   */
  children: ReactNode;
}

/**
 * Converts the `height` prop to a CSS value string.
 */
function resolveHeight(height: number | string): string {
  return typeof height === 'number' ? `${height}px` : height;
}

/**
 * Demo wrapper with lazy-mount lifecycle and wheel scroll capture.
 *
 * Lifecycle:
 * - Mounts DemoEngine when demo enters within 2×viewport height (rootMargin '200%').
 * - Unmounts when demo exits beyond 4×viewport height (rootMargin '400%').
 * - This hysteresis prevents WebGL context exhaustion on long pages.
 *
 * Re-mount behavior:
 * - Demo restarts from scratch (model loading, shader compilation).
 * - Brief blank canvas is acceptable; no loading spinner is shown.
 * - The placeholder div maintains identical height, preserving hash navigation.
 *
 * Scroll capture:
 * - When the pointer is inside the demo, wheel events advance demo progress.
 * - Ctrl+Wheel is never intercepted (browser zoom).
 * - At progress 0 scrolling up or progress 1 scrolling down, events pass through.
 */
export function DocsDemo({
  scrollUnits,
  height,
  title,
  children,
}: DocsDemoProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Imperative progress accumulator — avoids React re-render on every wheel tick.
  const progressRef = useRef(0);
  const setRawProgressRef = useRef<((p: number) => void) | null>(null);

  // ── IntersectionObserver lifecycle ────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Mount observer: element enters within ~2 viewport-heights.
    const mountObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setIsMounted(true);
      },
      { rootMargin: '200% 0px 200% 0px', threshold: 0 },
    );

    // Unmount observer: element exits beyond ~4 viewport-heights.
    const unmountObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry && !entry.isIntersecting) setIsMounted(false);
      },
      { rootMargin: '400% 0px 400% 0px', threshold: 0 },
    );

    mountObserver.observe(el);
    unmountObserver.observe(el);
    return () => {
      mountObserver.disconnect();
      unmountObserver.disconnect();
    };
  }, []);

  // ── DemoCaptureContext value ───────────────────────────────────────────────
  const captureCtx: DemoCaptureContextValue = useMemo(
    () => ({
      registerEngine: (setRawProgress) => {
        setRawProgressRef.current = setRawProgress;
        return () => {
          setRawProgressRef.current = null;
        };
      },
      onWheelDelta: (normalizedDeltaPx) => {
        const increment = normalizedDeltaPx / scrollUnits;
        const next = Math.max(0, Math.min(1, progressRef.current + increment));
        progressRef.current = next;
        setRawProgressRef.current?.(next);
      },
      getProgress: () => progressRef.current,
      scrollUnits,
    }),
    [scrollUnits],
  );

  const heightCss = resolveHeight(height);

  const containerStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: heightCss,
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
    margin: '20px 0',
    background: 'var(--bg-demo, #0a0a10)',
    boxShadow: 'var(--shadow-demo, 0 4px 32px rgba(0,0,0,0.5))',
  };

  const placeholderStyle: CSSProperties = {
    width: '100%',
    height: heightCss,
    // Identical height to containerStyle — required for hash navigation correctness.
  };

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {title !== undefined && (
        <p className="docs-demo__title" style={{ marginBottom: 8, opacity: 0.7, fontSize: 13 }}>
          {title}
        </p>
      )}
      <DemoCaptureContext.Provider value={captureCtx}>
        {isMounted ? (
          <WheelCaptureDemo active={isHovered} captureCtx={captureCtx}>
            <div style={containerStyle}>{children}</div>
          </WheelCaptureDemo>
        ) : (
          // Placeholder maintains identical height for correct hash navigation.
          <div style={placeholderStyle} aria-hidden="true" />
        )}
      </DemoCaptureContext.Provider>
    </div>
  );
}
