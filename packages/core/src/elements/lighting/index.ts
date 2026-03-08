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
  Vec3,
} from './types';
export { Lighting, Ambient, Directional, GlowPoint, Point, Spot, LightStrand, Wave, Circle, Rectangle, Panel } from './LightingWidget';
export { DEFAULT_LIGHTING, lightingTransitionSpec, functionalLightingTransitionSpec } from './compile';
export {
  applyLighting,
  setSceneLightEnabled,
  isSceneLightEnabled,
  clearSceneLightOverrides,
  type LightingThreeRefs,
} from './render';
export { LightingWidget } from './LightingWidget';
