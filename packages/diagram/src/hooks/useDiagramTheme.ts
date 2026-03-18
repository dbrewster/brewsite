// Convenience hook: resolves the current DiagramTheme from the active theme context.
// Scene components use this to get the right diagram theme without manual lookup.

import { useTheme } from '@brewsite/core';
import { resolveDiagramTheme } from '../elements/diagram/themeRegistry';
import type { DiagramTheme } from '../elements/diagram/types';

/**
 * Returns the DiagramTheme resolved from the current SceneTheme context
 * (set by `<SceneEngine theme={{ family: '...', polarity: '...' }}>`).
 *
 * Returns undefined when no theme context is provided — callers should fall back
 * to an explicit theme prop or a hardcoded default.
 *
 * Named family presets (darkGlass, midnight, etc.) are available after
 * @brewsite/themes has registered them at app startup via themesPlugin().
 *
 * @example
 * ```tsx
 * const diagramTheme = useDiagramTheme();
 * return <Diagram ... />;
 * ```
 */
export function useDiagramTheme(): DiagramTheme | undefined {
  const sceneTheme = useTheme();
  if (!sceneTheme) return undefined;
  const polarity = sceneTheme.colorMode;
  // Resolve using the default family — SceneTheme does not carry a family name.
  return resolveDiagramTheme('default', polarity);
}
