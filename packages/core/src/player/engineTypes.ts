import type { ReactElement } from 'react';
import type { SceneTrackTick } from '../compiler/sceneTrackTypes';

export type EngineFrameState = {
  tickIndex: number;
  progress: number;
  sceneId: string;
  sceneIndex: number;
  sceneProgress: number;
  tick: SceneTrackTick | null;
};

export type EngineState = {
  progress: number;
  sceneId: string;
  sceneIndex: number;
  sceneProgress: number;
};

/**
 * Internal scene spec linking a scene registration key to its compiled content.
 * Shared between ScenePlayer, EngineProvider, and useSceneEngine.
 */
export type InternalSceneSpec = {
  readonly sceneKey: string;
  readonly contentKey: string;
  readonly element: ReactElement;
};
