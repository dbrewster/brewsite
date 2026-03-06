// Re-export all element types and components
// Note: Model element moved to @brewsite/model package

// Lighting
export type {
  SceneLighting,
  SceneLightAmbient,
  SceneLightDirectional,
  SceneLightGlowPoint,
  SceneLightStrand,
  SceneLightStrandCurve,
  SceneLightStrandShape,
  SceneLightStrandWave,
  SceneLightStrandCircle,
  SceneLightStrandRectangle,
  LightStrandAxis,
  SceneLightPoint,
  SceneLightSpot,
  SceneLightPanel,
} from './lighting';
export { Lighting, Ambient, Directional, GlowPoint, Point, Spot, LightStrand, Wave, Circle, Rectangle, Panel } from './lighting';
export { DEFAULT_LIGHTING, lightingTransitionSpec } from './lighting';
export {
  applyLighting,
  setSceneLightEnabled,
  isSceneLightEnabled,
  clearSceneLightOverrides,
  type LightingThreeRefs,
} from './lighting';

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

// TextBox overlay element
export { TextBox } from './text-box';
export type { TextBoxProps } from './text-box';

// Camera
export type {
  SceneCamera,
  CameraPositionDescriptor,
  CameraLens,
  CameraPost,
  TrackpadCameraConfig,
  ICameraInteractionDriver,
  CameraInteractionDriverFactory,
  EaseFnName,
  CameraTransitionInterpolation,
  CameraOverrideState,
} from './camera';
export { Camera } from './camera';
export { DEFAULT_CAMERA, DEFAULT_CAMERA_DESCRIPTOR, cameraTransitionSpec } from './camera';
export { applyCamera } from './camera';
