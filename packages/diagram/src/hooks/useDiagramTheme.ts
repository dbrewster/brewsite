// Convenience hook: resolves the current DiagramTheme from ThemeKeyContext.
// Scene components use this to get the right diagram theme without manual lookup.

import { useThemeKey } from '@brewsite/core';
import { DIAGRAM_THEME_PAIRS } from '../elements/diagram/themes/index';
import type { DiagramTheme } from '../elements/diagram/types';

/**
 * Returns the DiagramTheme resolved from the current ThemeKeyContext
 * (set by `<SceneEngine themeFamily="..." themePolarity="...">`).
 *
 * Returns null when no ThemeKeyContext is provided — callers should fall back
 * to an explicit theme prop or a hardcoded default.
 *
 * @example
 * ```tsx
 * const diagramTheme = useDiagramTheme();
 * return <Diagram theme={diagramTheme ?? fallbackTheme} ... />;
 * ```
 */
export function useDiagramTheme(): DiagramTheme | undefined {
  const key = useThemeKey();
  if (!key) return undefined;
  return DIAGRAM_THEME_PAIRS[key.family]?.[key.polarity] ?? undefined;
}
