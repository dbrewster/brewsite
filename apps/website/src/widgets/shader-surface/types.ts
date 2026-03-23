// Compiled state for the shader surface widget — all numbers, no unit strings.

/** Compiled state for the shader surface element. */
export type ShaderSurfaceState = {
  readonly enabled: boolean;
  readonly kind: 'plane' | 'ribbon' | 'shell';
  readonly x: number;          // NVS fraction
  readonly y: number;          // NVS fraction
  readonly w: number;          // NVS fraction
  readonly h: number;          // NVS fraction
  readonly z: number;          // world-space depth
  readonly opacity: number;    // dimensionless [0..1]
  readonly palette: 'hero' | 'violet' | 'warm' | 'aurora';
  readonly edgeGlow: number;   // dimensionless
  readonly distortion: number; // dimensionless
  readonly scanStrength: number; // dimensionless
  readonly reveal: number;     // dimensionless [0..1]
};
