// Re-export all element types and components

// Model
export * from './model';

// Lighting
export type { SceneLighting, SceneLightAmbient, SceneLightDirectional, SceneLightPoint, SceneLightSpot, SceneLightPanel } from './lighting';
export { Lighting, Ambient, Directional, Point, Spot, Panel } from './lighting';
export { DEFAULT_LIGHTING, lightingTransitionSpec } from './lighting';
export { applyLighting, type LightingThreeRefs } from './lighting';

// Background
export type { SceneBackground } from './background';
export { Background } from './background';
export { DEFAULT_BACKGROUND, backgroundTransitionSpec } from './background';
export { applyBackground, type BackgroundDomRefs } from './background';

// Environment
export type {
  SceneEnvironment,
  EnvironmentSource,
  EnvironmentSourceHdri,
  EnvironmentSourceExr,
  EnvironmentSourceCube,
} from './environment';
export { Environment, EnvironmentHdri, EnvironmentExr, EnvironmentCube } from './environment';
export { DEFAULT_ENVIRONMENT, environmentTransitionSpec } from './environment';
export { applyEnvironment, type EnvironmentThreeRefs } from './environment';

// Floor
export type { SceneFloor, FloorSurface, FloorSurfaceMirror, FloorSurfacePhysical } from './floor';
export { Floor, FloorPhysical, FloorMirror } from './floor';
export { DEFAULT_FLOOR, floorTransitionSpec } from './floor';
export { applyFloor, type FloorThreeRefs } from './floor';

// Camera
export type { SceneCamera, CameraMode } from './camera';
export { Camera } from './camera';
export { DEFAULT_CAMERA, cameraTransitionSpec } from './camera';
export { applyCamera } from './camera';
