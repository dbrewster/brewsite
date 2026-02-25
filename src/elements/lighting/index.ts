export type { SceneLighting, SceneLightAmbient, SceneLightDirectional, SceneLightPoint, SceneLightSpot, SceneLightPanel, Vec3 } from './types';
export { Lighting, Ambient, Directional, Point, Spot, Panel } from './dsl';
export { DEFAULT_LIGHTING, lightingTransitionSpec, functionalLightingTransitionSpec } from './compile';
export { applyLighting, type LightingThreeRefs } from './render';
export { LightingWidget } from './LightingWidget';
