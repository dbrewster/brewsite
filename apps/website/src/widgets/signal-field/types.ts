// Compiled state for the signal field widget — all numbers, no unit strings.

/** Compiled state for the signal field particle system. */
export type SignalFieldState = {
  readonly enabled: boolean;
  readonly x: number;       // NVS fraction
  readonly y: number;       // NVS fraction
  readonly w: number;       // NVS fraction
  readonly h: number;       // NVS fraction
  readonly z: number;       // world-space depth
  readonly count: number;   // dimensionless
  readonly opacity: number; // dimensionless [0..1]
  readonly size: number;    // resolved spatial size
  readonly speed: number;   // dimensionless multiplier
  readonly depth: number;   // resolved spatial extent
  readonly spread: number;  // resolved spatial radius
  readonly flow: 'orbit' | 'stream' | 'assemble' | 'dissolve';
  readonly palette: 'hero' | 'violet' | 'warm' | 'aurora';
  readonly targetBias: number; // dimensionless [0..1]
};
