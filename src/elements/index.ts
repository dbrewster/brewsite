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
export type { SceneEnvironment } from './environment';
export { Environment } from './environment';
export { DEFAULT_ENVIRONMENT, environmentTransitionSpec } from './environment';
export { applyEnvironment, type EnvironmentThreeRefs } from './environment';

// Floor
export type { SceneFloor } from './floor';
export { Floor } from './floor';
export { DEFAULT_FLOOR, floorTransitionSpec } from './floor';
export { applyFloor, type FloorThreeRefs } from './floor';
