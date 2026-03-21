import type { ReactNode } from 'react';
import type { SceneFrame } from './sceneTrackTypes';
import type { VariableStoreReader, JsonPrimitive } from '../widget/VariableStore';
import type { ThemeFamily, SceneTheme } from '../theme/types';
import type { WidgetRegistry } from '../widget/WidgetRegistry';

export type SceneSnapshotContext = {
  /** 0-based index of this scene in the scene array. */
  sceneIndex: number;
  /** Total number of scenes. */
  numScenes: number;
  /** Whether model/texture assets have finished loading. */
  assetsReady: boolean;
  /** Runtime variable store — for variable-driven DSL content. */
  variables?: VariableStoreReader;
  /** Viewport dimensions — for viewport-responsive DSL layout. */
  viewport?: { width: number; height: number; aspectRatio: number };
  /**
   * Active theme family for this engine instance.
   * Passed from SceneEngine.theme into every NodeHandler via CompileApi.context.
   * Defaults to 'default' when no theme is configured.
   */
  themeFamily: ThemeFamily;
  /**
   * Active theme polarity for this engine instance.
   * Defaults to 'dark' when no theme is configured.
   */
  themePolarity: 'dark' | 'light';
  /**
   * Optional scene theme tokens for cross-package theming.
   * Contains font URLs (webglFontUrl), font size scales, and color mode.
   * Consumed by downstream NodeHandlers — e.g., the diagram handler
   * bridges this into `DiagramTheme.sceneTheme` for font and sizing integration.
   *
   * Optional — existing scenes without a SceneTheme behave identically to before.
   */
  sceneTheme?: SceneTheme;
  /**
   * The WidgetRegistry for this compilation pass. Handlers that lazily create
   * widgets (e.g., Diagram, Chart) MUST use this instead of closure-captured
   * registry references to support multi-engine pages where each engine has
   * its own registry instance.
   * Optional for backward compatibility with tests and direct callers.
   */
  widgetRegistry?: WidgetRegistry;
};

/**
 * A prop value that can either be a plain value or a function that derives
 * the value from the current scene snapshot context.
 */
export type Resolvable<T> = T | ((context: SceneSnapshotContext) => T);

/**
 * @internal Constructed by ScenePlayer from registered <Scene> elements.
 */
export type SceneDefinition = {
  id: string;
  meta?: Record<string, JsonPrimitive>;
  getFrame: (context: SceneSnapshotContext) => ReactNode | SceneFrame;
};
