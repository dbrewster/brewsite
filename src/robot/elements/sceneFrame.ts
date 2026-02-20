// Re-exports SceneFrame from its current location.
// Wave 1 will assemble this from element types.ts files instead.
export type { SceneFrame, SceneFrameOverride } from '../model/robotSceneTypes';

// Backward-compat alias. Will be the canonical name post-Wave 1.
export type { SceneFrame as SceneFrameState } from '../model/robotSceneTypes';
