// Viewport container for the scene engine. Supports scroll and direct input modes.
// Canvas rendering and ResizeObserver have moved to SceneCanvas.
// This component is the scroll-spacer + sticky container infrastructure only.

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
  const mode = engine.inputMode;
  // When filling a container, use 100% so the parent's explicit height
  // constrains us. Otherwise fall back to 100vh for full-page layouts.
  const viewportFill = fillContainer ? '100%' : '100vh';

  const innerContent = (
    <div
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
      {/* Background widget DOM element — positioned at z:0 */}
      <div
        ref={engine.setBackgroundRef}
        style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundPosition: 'center', backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat', pointerEvents: 'none',
        }}
      />
      {/* Children — SceneCanvas, EngineOverlayHost, LabelItems, etc. */}
      {children && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          {children}
        </div>
      )}
    </div>
  );

  if (mode === 'direct') {
    return (
      <div
        ref={engine.scrollRegionRef}
        className={className}
        style={{ position: 'relative', height: viewportFill }}
      >
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
