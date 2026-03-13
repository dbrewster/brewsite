// SceneReel.tsx — Convenience wrapper for embedded/docs/slides use cases.
// Composes SceneEngine + SceneCanvas + BackgroundLayer + EngineOverlayHost into a
// sized, overflow-hidden container. Input components are consumer-provided children.

import { useContext, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { SceneEngine } from './SceneEngine';
import type { SceneEngineProps } from './SceneEngine';
import { SceneCanvas } from './SceneCanvas';
import { BackgroundLayer } from './BackgroundLayer';
import { EngineOverlayHost } from './EngineOverlayHost';
import { EngineARContainerContext } from './EngineARContainer';

// DEBT: SceneReel does not accept or forward themeFamily, themePolarity, or scrollSource props
export interface SceneReelProps {
  // ── Layout ──────────────────────────────────────────────────────────────────
  /** CSS width. Default: '100%'. */
  width?: string | number;
  /** CSS height. Required. */
  height: string | number;
  className?: string;

  // ── Engine config (all forwarded to SceneEngine) ─────────────────────────────
  plugins?: SceneEngineProps['plugins'];
  id?: string;
  timingProfile?: SceneEngineProps['timingProfile'];
  primaryCameraId?: string;
  primaryCanvasActionTargetId?: string;
  cameraInteractionDefaults?: SceneEngineProps['cameraInteractionDefaults'];
  invalidateCacheToken?: number | string;
  maxAnimBoostPerFrame?: number;
  sceneTheme?: SceneEngineProps['sceneTheme'];

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  onReady?: () => void;
  onError?: (error: Error) => void;
  onWidgetError?: (widgetId: string, error: Error) => void;
  onCompileWarning?: SceneEngineProps['onCompileWarning'];

  // ── Content ─────────────────────────────────────────────────────────────────
  /**
   * <Scene> components, input components, and optionally EngineGate or overlay content.
   * SceneReel adds SceneCanvas, BackgroundLayer, and EngineOverlayHost automatically.
   */
  children: ReactNode;
}

/**
 * SceneReel — convenience wrapper for embedded/docs/slides use cases.
 * Composes SceneEngine + SceneCanvas + BackgroundLayer + EngineOverlayHost into
 * a sized, overflow-hidden container. Add input components as children.
 */
export function SceneReel(props: SceneReelProps): ReactElement {
  const arCtx = useContext(EngineARContainerContext);

  // Resolve height: AR container overrides when computedArHeight > 0
  const resolvedHeight: string =
    arCtx.computedArHeight > 0
      ? `${arCtx.computedArHeight}px`
      : typeof props.height === 'number'
        ? `${props.height}px`
        : props.height;

  const resolvedWidth: string =
    typeof props.width === 'number'
      ? `${props.width}px`
      : (props.width ?? '100%');

  const containerStyle: CSSProperties = {
    width: resolvedWidth,
    height: resolvedHeight,
    position: 'relative',
    overflow: 'hidden',
  };

  return (
    <div className={props.className} style={containerStyle}>
      <SceneEngine
        id={props.id}
        plugins={props.plugins}
        timingProfile={props.timingProfile}
        primaryCameraId={props.primaryCameraId}
        primaryCanvasActionTargetId={props.primaryCanvasActionTargetId}
        cameraInteractionDefaults={props.cameraInteractionDefaults}
        invalidateCacheToken={props.invalidateCacheToken}
        maxAnimBoostPerFrame={props.maxAnimBoostPerFrame}
        sceneTheme={props.sceneTheme}
        onReady={props.onReady}
        onError={props.onError}
        onWidgetError={props.onWidgetError}
        onCompileWarning={props.onCompileWarning}
      >
        {/* Consumer Scene declarations and input components */}
        {props.children}

        {/* Reel-provided infrastructure (always rendered) */}
        <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
        <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          <SceneCanvas style={{ width: '100%', height: '100%' }} />
        </div>
        <EngineOverlayHost />
      </SceneEngine>
    </div>
  );
}
