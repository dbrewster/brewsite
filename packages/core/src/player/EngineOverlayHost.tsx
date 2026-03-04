// Renders the active scene's overlay ReactNode above the canvas.
// Position as a sibling of SceneCanvas inside a position:relative container.
// Scene overlay content comes from non-DSL React children of <Scene>.

import { useEffect, type CSSProperties, type ReactElement } from 'react';
import { useEngineState } from './EngineStateContext';
import { useSceneEngineContext } from './EngineContext';
import { useTheme } from '../theme/ThemeContext';

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
  const theme = useTheme();

  useEffect(() => {
    injectOverlayAnimation();
  }, []);

  const overlayContent = engine.sceneOverlays?.get(sceneId);

  if (!overlayContent) return null;

  const transitionEnabled = overlayTransition?.enabled ?? true;
  const transitionDurationMs = overlayTransition?.durationMs ?? 200;
  const transitionEasing = overlayTransition?.easing ?? 'ease-out';

  // Build CSS variable injection object when theme is present.
  // CSSProperties doesn't include custom properties; cast is required.
  const themeStyles = theme ? ({
    '--brewsite-font-family':          theme.font.htmlFamily,
    fontFamily:                        'var(--brewsite-font-family)',
    '--brewsite-font-size-heading':    `calc(1rem * ${theme.fontSize.heading})`,
    '--brewsite-font-size-body':       `calc(1rem * ${theme.fontSize.body})`,
    '--brewsite-font-size-label':      `calc(1rem * ${theme.fontSize.label})`,
    '--brewsite-font-size-caption':    `calc(1rem * ${theme.fontSize.caption})`,
    '--brewsite-font-size-annotation': `calc(1rem * ${theme.fontSize.annotation})`,
    '--brewsite-color-mode':           theme.colorMode,
    '--brewsite-text-primary':
      theme.colorMode === 'dark' ? '#ffffff' : '#111111',
    '--brewsite-text-secondary':
      theme.colorMode === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
    // accentColor is only injected when set. Setting '--brewsite-accent-color' to ''
    // (empty string) would cause var(--brewsite-accent-color, fallback) to return ''
    // instead of the fallback — CSS treats empty value as "set but invalid". Skip
    // injection entirely when accentColor is absent so consumer fallbacks work correctly.
    ...(theme.accentColor ? { '--brewsite-accent-color': theme.accentColor } : {}),
  } as CSSProperties) : {};

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
        ...themeStyles,
      }}
    >
      {overlayContent}
    </div>
  );
};
