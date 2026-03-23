// Shared background presets for website scenes.

/**
 * Background preset configuration for scene DSL consumption.
 * Values are spread directly into Background DSL component props.
 */
export type BackgroundPreset = {
  readonly color: string;
  readonly opacity: number;
};

/** Deep dark chamber background for hero and CTA. */
export const heroBg: BackgroundPreset = {
  color: '#050a12',
  opacity: 1,
};

/** Slightly lifted dark background for problem/recognition. */
export const flatBg: BackgroundPreset = {
  color: '#0a0f18',
  opacity: 1,
};

/** Rich dark background for transformation acts. */
export const transformBg: BackgroundPreset = {
  color: '#060c16',
  opacity: 1,
};

/** Clean dark background for authoring and pipeline. */
export const authoringBg: BackgroundPreset = {
  color: '#080e1a',
  opacity: 1,
};

/** Warm return background for ecosystem and trust. */
export const ecosystemBg: BackgroundPreset = {
  color: '#0a0e18',
  opacity: 1,
};
