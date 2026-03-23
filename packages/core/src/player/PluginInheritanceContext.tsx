// PluginInheritanceContext.tsx — Enables SceneEngine zero-scene plugin inheritance.

import { createContext } from 'react';
import type { WidgetPlugin } from '../widget/WidgetPlugin';

/**
 * Provided by every SceneEngine with its resolved plugin array.
 * Consumed by nested SceneEngine / SceneEmbed instances that omit their own
 * `plugins` prop, allowing app-level plugin hoisting from a root SceneEngine.
 *
 * null = no ancestor SceneEngine has provided plugins.
 */
export const PluginInheritanceContext = createContext<WidgetPlugin[] | null>(null);
