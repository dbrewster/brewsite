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

// Background
export type { SceneBackground } from './background';
export { Background } from './background';

// Environment
export type {
  SceneEnvironment,
  EnvironmentSource,
  EnvironmentSourceHdri,
  EnvironmentSourceExr,
  EnvironmentSourceCube,
} from './environment';
export { Environment, EnvironmentHdri, EnvironmentExr, EnvironmentCube } from './environment';

// Floor
export type { SceneFloor, FloorSurface, FloorSurfaceMirror, FloorSurfacePhysical } from './floor';
export { Floor, FloorPhysical, FloorMirror } from './floor';

// TextBox overlay element
export { TextBox } from './text-box';
export type { TextBoxProps } from './text-box';

// Scene key constants
export {
  SCENE_CAMERA_KEY, SCENE_LIGHTING_KEY, SCENE_BACKGROUND_KEY,
  SCENE_ENVIRONMENT_KEY, SCENE_FLOOR_KEY,
} from './sceneKeys';

// Shared material factory (CSM preset materials for downstream packages)
export {
  createPresetMaterial, applyMaterialApplication, updatePresetTextures,
} from './_shared/materialFactory';
export type { PresetMaterialOptions, PresetMaterialProjection } from './_shared/materialFactory';

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
  WorldSpaceCamera,
  OrbitCamera,
  FitBotHeightCamera,
  FitFloorDepthCamera,
  ICameraHost,
  CameraInteractionDefaults,
} from './camera';
export { Camera } from './camera';

// Carousel highlights
export type { ViewHighlightMode, ViewHighlightConfig } from './carousel-scrubber';
export { useCarouselHighlight, createCarouselHighlightController } from './carousel-scrubber';
