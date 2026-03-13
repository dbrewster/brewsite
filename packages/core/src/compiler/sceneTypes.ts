import type { ReactNode } from 'react';
import type { SceneFrame } from './sceneTrackTypes';
import type { VariableStoreReader, JsonPrimitive } from '../widget/VariableStore';
import type { ThemeFamily } from '../theme/types';

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
