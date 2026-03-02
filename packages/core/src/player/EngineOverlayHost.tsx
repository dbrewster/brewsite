// Renders the active scene's overlay ReactNode above the canvas.
// Position as a sibling of SceneCanvas inside a position:relative container.
// Scene overlay content comes from non-DSL React children of <Scene>.

import { useEffect, type ReactElement } from 'react';
import { useEngineState } from './EngineStateContext';
import { useSceneEngineContext } from './EngineContext';

// Inject the entry animation keyframe once per document (global scope, runs once on load).
// This is the standard library pattern for component-scoped global animations.
let _animationKeyframeInjected = false;
const injectOverlayAnimation = () => {
  if (_animationKeyframeInjected || typeof document === 'undefined') return;
  _animationKeyframeInjected = true;
  const style = document.createElement('style');
  style.textContent = `@keyframes brewsite-overlay-enter { from { opacity: 0; } to { opacity: 1; } }`;
  document.head.appendChild(style);
};

export interface EngineOverlayHostProps {
  className?: string;
  /**
   * When true, pointer events pass through the overlay to the canvas.
   * Individual overlay elements can re-enable pointer events with:
   *   style={{ pointerEvents: 'auto' }}
   * Default: false (overlay intercepts pointer events — use for interactive content).
   */
  passthroughPointerEvents?: boolean;
  overlayTransition?: {
    enabled?: boolean;
    durationMs?: number;
    easing?: string;
  };
}

export const EngineOverlayHost = ({
  className,
  passthroughPointerEvents = false,
  overlayTransition,
}: EngineOverlayHostProps): ReactElement | null => {
  const { sceneId } = useEngineState();
  const engine = useSceneEngineContext();

  useEffect(() => {
    injectOverlayAnimation();
  }, []);

  const overlayContent = engine.sceneOverlays?.get(sceneId);

  if (!overlayContent) return null;

  const transitionEnabled = overlayTransition?.enabled ?? true;
  const transitionDurationMs = overlayTransition?.durationMs ?? 200;
  const transitionEasing = overlayTransition?.easing ?? 'ease-out';

  return (
    <div
      key={sceneId}                   // unmount + remount on scene change → CSS enter animation
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 10,
        pointerEvents: passthroughPointerEvents ? 'none' : 'auto',
        ...(transitionEnabled
          ? { animation: `brewsite-overlay-enter ${transitionDurationMs}ms ${transitionEasing}` }
          : {}),
      }}
    >
      {overlayContent}
    </div>
  );
};
