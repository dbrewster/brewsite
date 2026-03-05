// Viewport container for the scene engine. Supports scroll and direct input modes.
// Canvas rendering and ResizeObserver have moved to SceneCanvas.
// This component is the scroll-spacer + sticky container infrastructure only.
// Reads engine state from EngineContext internally — no engine prop required.

import { useContext, type ReactElement, type ReactNode } from 'react';
import { useSceneEngineContext } from './EngineContext';
import { EngineARContainerContext } from './EngineARContainer';

export type EngineInputRegionProps = {
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
  className,
  children,
  fillContainer = false,
}: EngineInputRegionProps): ReactElement => {
  const engine = useSceneEngineContext();
  const mode = engine.inputMode;
  const arCtx = useContext(EngineARContainerContext);
  // When inside EngineARContainer, use computedArHeight (AR-derived from width)
  // rather than containerHeight (the outer div's observed height, which is
  // inflated by the scroll spacer on first render). Falls back to 100%
  // (fillContainer) or 100vh when not inside EngineARContainer or before the
  // outer div has a valid width measurement.
  const stickyHeight = arCtx.computedArHeight > 0
    ? `${arCtx.computedArHeight}px`
    : fillContainer ? '100%' : '100vh';

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
        height: stickyHeight,
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
        style={{ position: 'relative', height: stickyHeight }}
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
