// Demo container: inline block in normal document flow. No wheel capture.

import {
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';

export interface DocsDemoProps {
  /**
   * Height of the demo container in the page flow.
   *
   * number → treated as pixels. `height={480}` → CSS `height: 480px`.
   * string → passed directly as a CSS length. `height="100vh"` or `height="50vh"`.
   */
  height: number | string;
  /** Optional title displayed above the demo canvas. */
  title?: string;
  /**
   * Demo content. The engine context is provided by the ancestor EngineProvider
   * (now at DocsApp level). No DemoEngine needed inside DocsDemo.
   */
  children: ReactNode;
  /**
   * @deprecated scrollUnits is no longer used. It was previously needed for
   * the wheel-capture island model. In the unified scroll model, scroll budgets
   * are declared via <ProgressManager scrollUnits={...}> in the scene DSL.
   * This prop is retained for a deprecation cycle to avoid immediate API breakage.
   * It is silently ignored.
   */
  scrollUnits?: number;
}

function resolveHeight(height: number | string): string {
  return typeof height === 'number' ? `${height}px` : height;
}

/**
 * Inline demo container.
 *
 * Renders a fixed-height block element in the normal document flow.
 * No wheel event capture. No independent engine. No IntersectionObserver.
 *
 * The scene engine powering demo canvases is provided by the ancestor
 * EngineProvider (mounted at the DocsApp level). Scene transitions are driven
 * by window scroll via ScrollCaptureSection.
 */
export function DocsDemo({
  height,
  title,
  children,
}: DocsDemoProps): ReactElement {
  const heightCss = resolveHeight(height);

  const containerStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: heightCss,
    borderRadius: '8px',
    border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
    margin: '20px 0',
    background: 'var(--bg-demo, #0a0a10)',
    boxShadow: 'var(--shadow-demo, 0 4px 32px rgba(0,0,0,0.5))',
    // overflow: hidden is intentionally removed — no nested scroll
  };

  return (
    <div>
      {title !== undefined && (
        <p className="docs-demo__title" style={{ marginBottom: 8, opacity: 0.7, fontSize: 13 }}>
          {title}
        </p>
      )}
      <div style={containerStyle}>
        {children}
      </div>
    </div>
  );
}
