// Compiled state for the PostFX widget — all dimensionless numbers and enums.

/** Compiled post-processing state. All fields are dimensionless — no unit strings. */
export type PostFxState = {
  readonly enabled: boolean;
  readonly bloomStrength: number;
  readonly bloomRadius: number;
  readonly bloomThreshold: number;
  readonly vignetteStrength: number;
  readonly gradeMix: number;
  readonly quality: 'high' | 'medium' | 'off';
};
