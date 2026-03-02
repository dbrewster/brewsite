import type { ReactElement, RefObject } from 'react';
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

export type InputModePolicy = 'auto' | 'prefer-scroll' | 'prefer-direct';

export type ScrollSource =
  | 'window'
  | { kind: 'element'; elementRef: RefObject<HTMLElement | null> };

export type EngineTimingProfile = {
  blockSize?: number;
  qualityPreset?: 'performance' | 'balanced' | 'high';
  fpsCap?: number;
};

export type CameraInteractionDefaults = {
  wheelLockIdleMs?: number;
  wheelAxisDominance?: number;
  wheelAxisActivationThreshold?: number;
  orbitPolarMin?: number;
  orbitPolarMax?: number;
  dollyRadiusMin?: number;
  dollyRadiusMax?: number;
};
