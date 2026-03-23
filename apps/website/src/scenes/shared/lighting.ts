// Shared lighting presets for website scenes.

/**
 * Lighting preset configuration for scene DSL consumption.
 * Values are spread directly into Lighting DSL component props.
 */
export type LightingPreset = {
  readonly ambientIntensity: number;
  readonly directionalIntensity: number;
  readonly directionalX: number;
  readonly directionalY: number;
  readonly directionalZ: number;
};

/** Moody chamber lighting for the hero and CTA acts. */
export const heroLighting: LightingPreset = {
  ambientIntensity: 0.3,
  directionalIntensity: 0.6,
  directionalX: 2,
  directionalY: 4,
  directionalZ: 3,
};

/** Flat, restrained lighting for the problem/recognition act. */
export const flatLighting: LightingPreset = {
  ambientIntensity: 0.5,
  directionalIntensity: 0.4,
  directionalX: 0,
  directionalY: 3,
  directionalZ: 2,
};

/** Richer, warmer lighting for transformation acts. */
export const transformLighting: LightingPreset = {
  ambientIntensity: 0.4,
  directionalIntensity: 0.7,
  directionalX: 3,
  directionalY: 5,
  directionalZ: 4,
};

/** Clean, even lighting for authoring and pipeline acts. */
export const authoringLighting: LightingPreset = {
  ambientIntensity: 0.45,
  directionalIntensity: 0.5,
  directionalX: 1,
  directionalY: 3,
  directionalZ: 3,
};
