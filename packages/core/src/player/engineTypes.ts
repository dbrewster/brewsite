import type { ReactElement, RefObject } from 'react';
import type { SceneTrackTick } from '../compiler/sceneTrackTypes';

export type EngineFrameState = {
  tickIndex: number;
  progress: number;
  sceneId: string;
  sceneIndex: number;
  sceneProgress: number;
  /** Current tick snapshot. Null before the engine's first frame. */
  tick?: SceneTrackTick | null;
};

/**
 * @deprecated Use EngineFrameState instead.
 * EngineState was a subset of EngineFrameState differing only in the absence
 * of the `tick` field. EngineFrameState now has `tick` as optional.
 */
export type EngineState = EngineFrameState;

// Re-export CameraInteractionDefaults from canonical location (elements/camera/types).
// useSceneEngine.ts and EngineProvider.tsx import this from './engineTypes' — the re-export
// keeps those imports working without modification.
export type { CameraInteractionDefaults } from '../elements/camera/types';

/**
 * Internal scene spec linking a scene registration key to its compiled content.
 * Shared between ScenePlayer, EngineProvider, and useSceneEngine.
 */
export type InternalSceneSpec = {
  readonly sceneKey: string;
  readonly contentKey: string;
  readonly element: ReactElement;
};

export type InputModePolicy = 'auto' | 'prefer-scroll' | 'prefer-direct';

export type ScrollSource =
  | 'window'
  | { kind: 'element'; elementRef: RefObject<HTMLElement | null> };

export type EngineTimingProfile = {
  blockSize?: number;
  qualityPreset?: 'performance' | 'balanced' | 'high';
  fpsCap?: number;
};
