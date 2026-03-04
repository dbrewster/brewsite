// React context for SceneTheme — populated by EngineProvider, consumed by EngineOverlayHost.
// ThemeContext holds a static player-level value. It does not update per scene.

import { createContext, useContext } from 'react';
import type { SceneTheme } from './types';

/**
 * React context carrying the player-level SceneTheme.
 * Default value is null (no theme). ThemeContext is opt-in.
 */
export const ThemeContext = createContext<SceneTheme | null>(null);

/**
 * Returns the current SceneTheme from context, or null if none is provided.
 * Does NOT throw — ThemeContext is purely opt-in.
 * Use this in EngineOverlayHost to read theme tokens for CSS variable injection.
 */
export const useTheme = (): SceneTheme | null => useContext(ThemeContext);
