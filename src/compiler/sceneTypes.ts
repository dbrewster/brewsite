import type { ReactNode } from 'react';
import type { SceneFrame } from './sceneTrackTypes';
import type { VariableStoreReader, JsonPrimitive } from '../widget/VariableStore';

export type SceneFrameState = SceneFrame; // alias

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
};

export type SceneDefinition = {
  id: string;
  index: number;
  meta?: Record<string, JsonPrimitive>;
  getFrame: (context: SceneSnapshotContext) => ReactNode | SceneFrame;
};

export type SceneGroup = {
  id: string;
  scenes: SceneDefinition[];
};
