// Renders TextBox overlays above the canvas, sourced from VariableStore and the
// shared TextBox children map. Position as a sibling of SceneCanvas inside a
// position:relative container.

import { useContext, useEffect, type CSSProperties, type ReactElement } from 'react';
import { useEngineState } from './EngineStateContext';
import { useTheme } from '../theme/ThemeContext';
import { VariableStoreContext } from '../widget/VariableStoreContext';
import { useTextBoxChildren } from './TextBoxChildrenContext';
import { TEXTBOX_NAMESPACE } from '../elements/text-box';

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

/**
 * Computes CSS style for a TextBox with anchor='viewport'.
 * Uses position:fixed to escape the AR container and pin to a viewport edge.
 */
function computeViewportAnchorStyle(
  edge: string | undefined,
  inset: number,
  opacity: number,
  layer: number,
  overflow: string,
): CSSProperties {
  const insetPercent = `${inset * 100}%`;
  switch (edge) {
    case 'top':
      return {
        position: 'fixed',
        top: insetPercent,
        left: 0,
        right: 0,
        opacity,
        overflow: overflow as 'hidden' | 'visible',
        zIndex: layer,
      };
    case 'bottom':
      return {
        position: 'fixed',
        bottom: insetPercent,
        left: 0,
        right: 0,
        opacity,
        overflow: overflow as 'hidden' | 'visible',
        zIndex: layer,
      };
    case 'left':
      return {
        position: 'fixed',
        left: insetPercent,
        top: 0,
        bottom: 0,
        opacity,
        overflow: overflow as 'hidden' | 'visible',
        zIndex: layer,
      };
    case 'right':
      return {
        position: 'fixed',
        right: insetPercent,
        top: 0,
        bottom: 0,
        opacity,
        overflow: overflow as 'hidden' | 'visible',
        zIndex: layer,
      };
    default:
      return {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        opacity,
        overflow: overflow as 'hidden' | 'visible',
        zIndex: layer,
      };
  }
}

export const EngineOverlayHost = ({
  className,
  passthroughPointerEvents = false,
  overlayTransition,
}: EngineOverlayHostProps): ReactElement | null => {
  const { sceneId } = useEngineState();
  const theme = useTheme();
  const variableStore = useContext(VariableStoreContext);
  const childrenMap = useTextBoxChildren();

  useEffect(() => {
    injectOverlayAnimation();
  }, []);

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

  // Collect all TextBox widget IDs currently registered in the VariableStore.
  // Pattern: namespace '__textbox', keys like 'widgetId.x', 'widgetId.y', etc.
  // We collect distinct widgetIds by splitting each key on the first '.'.
  const nsEntries = variableStore?.getNamespace(TEXTBOX_NAMESPACE) ?? {};
  const widgetIds = new Set<string>();
  for (const key of Object.keys(nsEntries)) {
    const dotIdx = key.indexOf('.');
    if (dotIdx > 0) widgetIds.add(key.slice(0, dotIdx));
  }

  // Render each TextBox as a positioned div inside the overlay container.
  const textBoxElements = Array.from(widgetIds).map((widgetId) => {
    const get = (k: string) => nsEntries[`${widgetId}.${k}`];
    const anchor = (get('anchor') as string | null | undefined) ?? 'scene';
    const opacity = Number(get('opacity') ?? 1);
    const layer = Number(get('layer') ?? 0);
    const overflow = (get('overflow') as string | null | undefined) ?? 'hidden';
    const children = childrenMap.get(widgetId);

    if (anchor === 'viewport') {
      const edge = get('edge') as string | null | undefined;
      const inset = Number(get('inset') ?? 0);
      const viewportStyle = computeViewportAnchorStyle(
        edge ?? undefined,
        inset,
        opacity,
        layer,
        overflow,
      );
      return (
        <div key={widgetId} style={viewportStyle}>
          {children}
        </div>
      );
    }

    // anchor === 'scene' — NVS percentage positioning relative to the AR container
    const x = Number(get('x') ?? 0);
    const y = Number(get('y') ?? 0);
    const w = Number(get('w') ?? 1);
    const h = Number(get('h') ?? 1);
    const sceneStyle: CSSProperties = {
      position: 'absolute',
      left: `${x * 100}%`,
      top: `${y * 100}%`,
      width: `${w * 100}%`,
      height: `${h * 100}%`,
      opacity,
      overflow: overflow as 'hidden' | 'visible',
      zIndex: layer,
    };
    return (
      <div key={widgetId} style={sceneStyle}>
        {children}
      </div>
    );
  });

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
      {textBoxElements}
    </div>
  );
};
