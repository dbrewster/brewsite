// Convenience hook: resolves the current DiagramTheme from ThemeKeyContext.
// Scene components use this to get the right diagram theme without manual lookup.

import { useThemeKey } from '@brewsite/core';
import { resolveDiagramTheme } from '../elements/diagram/themeRegistry';
import type { DiagramTheme } from '../elements/diagram/types';

/**
 * Returns the DiagramTheme resolved from the current ThemeKeyContext
 * (set by `<SceneEngine themeFamily="..." themePolarity="...">`).
 *
 * Returns undefined when no ThemeKeyContext is provided — callers should fall back
 * to an explicit theme prop or a hardcoded default.
 *
 * @example
 * ```tsx
 * const diagramTheme = useDiagramTheme();
 * return <Diagram ... />;
 * ```
 */
export function useDiagramTheme(): DiagramTheme | undefined {
  const key = useThemeKey();
  if (!key) return undefined;
  return resolveDiagramTheme(key.family, key.polarity);
}
