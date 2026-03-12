// Renders scene overlay content above the canvas, sourced from compiled sceneOverlays.
// Position as a sibling of SceneCanvas inside a position:relative container.

import { useEffect, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { useTheme } from '../theme/ThemeContext';
import { SCENE_THEME_PAIRS } from '../theme/presets';
import type { ThemeFamily } from '../theme/types';
import type { SceneTheme } from '../theme/types';
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

/**
 * Resolves the ThemeFamily name for a SceneTheme by reference equality lookup
 * through SCENE_THEME_PAIRS. Returns undefined for custom (non-registry) themes.
 * O(12) lookup — 6 families × 2 polarities.
 */
function resolveThemeFamily(theme: SceneTheme): ThemeFamily | undefined {
  for (const [family, pair] of Object.entries(SCENE_THEME_PAIRS) as Array<[string, { dark: SceneTheme; light: SceneTheme }]>) {
    if (pair.dark === theme || pair.light === theme) {
      return family as ThemeFamily;
    }
  }
  return undefined;
}

/**
 * Host element for scene overlay content rendered above the Three.js canvas.
 *
 * When a SceneTheme is active via ThemeContext (from EngineProvider.sceneTheme),
 * this component:
 * - Injects CSS custom properties: --brewsite-font-family, --brewsite-font-size-*,
 *   --brewsite-color-mode, --brewsite-text-primary, --brewsite-text-secondary,
 *   --brewsite-background-color, --brewsite-surface-elevated, --brewsite-border-subtle,
 *   --brewsite-radius-base
 * - Adds CSS classes: bw-theme-{family} (when theme is from SCENE_THEME_PAIRS),
 *   bw-dark or bw-light (from colorMode)
 *
 * NOTE: --brewsite-background-color is for HTML overlay content only.
 * BackgroundLayer reads SceneTheme.background.fill directly and does NOT consume
 * this variable. Overriding --brewsite-background-color via CSS changes overlay
 * child styling but not the Three.js scene background.
 *
 * Consumers may override CSS variables by targeting the injected classes:
 *   .bw-theme-darkGlass { --brewsite-text-primary: #e0e8ff; }
 */
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
  /** Optional children rendered inside the overlay container alongside HUD items. */
  children?: ReactNode;
}

export const EngineOverlayHost = ({
  className,
  passthroughPointerEvents = false,
  overlayTransition,
  children,
}: EngineOverlayHostProps): ReactElement | null => {
  const engine = useSceneEngineContext();
  const theme = useTheme();

  useEffect(() => {
    injectOverlayAnimation();
  }, []);

  const sceneId = engine.frameState.sceneId;
  const overlay = engine.sceneOverlays?.get(sceneId);

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
    // NEW in theming-overhaul:
    '--brewsite-background-color':
      theme.background?.fill?.kind === 'color'
        ? theme.background.fill.value
        : (theme.colorMode === 'dark' ? '#0a0a14' : '#f5f5f7'),
    '--brewsite-surface-elevated':
      theme.colorMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    '--brewsite-border-subtle':
      theme.colorMode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
    '--brewsite-radius-base': '6px',
  } as CSSProperties) : {};

  // Compute theme class names for CSS-based overlay overrides.
  // .bw-theme-{family} enables family-scoped CSS overrides.
  // .bw-dark / .bw-light enables polarity-scoped CSS overrides.
  const themeFamily = theme ? resolveThemeFamily(theme) : undefined;
  const computedClassName = [
    themeFamily ? `bw-theme-${themeFamily}` : undefined,
    theme ? (theme.colorMode === 'dark' ? 'bw-dark' : 'bw-light') : undefined,
    className,
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div
      className={computedClassName}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 10,
        pointerEvents: passthroughPointerEvents ? 'none' : 'auto',
        ...themeStyles,
      }}
    >
      {/*
        key={sceneId} is scoped to this inner wrapper so that scene-change CSS enter
        animations apply only to the HUD overlay content, not to persistent children
        (e.g. ChartTooltipHost) that must survive scene transitions without remounting.
      */}
      <div
        key={sceneId}
        style={transitionEnabled
          ? { animation: `brewsite-overlay-enter ${transitionDurationMs}ms ${transitionEasing}` }
          : undefined}
      >
        {overlay}
      </div>
      {children}
    </div>
  );
};
