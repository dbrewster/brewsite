/**
 * Lighting element types.
 */

import type { Vec3 } from '../../math';
export type { Vec3 } from '../../math';

export type SceneLightAmbient = {
  id?: string;
  intensity: number;
  color: string;
};

export type SceneLightDirectional = {
  id?: string;
  intensity: number;
  color: string;
  /**
   * World-space position. For directional lights, only the direction from origin to this
   * position matters — Three.js normalises it internally, so the magnitude does not affect
   * intensity or shadow frustum. The default `[10, 10, 10]` places the key light above-right-front.
   */
  position: Vec3;
};

export type SceneLightPoint = {
  id?: string;
  intensity: number;
  color: string;
  /** World-space position of the point light source. */
  position: Vec3;
};

export type SceneLightGlowPoint = {
  id?: string;
  intensity: number;
  color: string;
  /** World-space position of the glow-point light source. */
  position: Vec3;
  distance?: number;
  decay?: number;
};

export type SceneLightStrandCurve = {
  length: number;
  /** @deprecated Use length. */
  width?: number;
  yOffset: number;
  z: number;
  waveAmplitude: number;
  waveFrequency: number;
  depthAmplitude: number;
  depthFrequency: number;
  depthPhase: number;
};

export type LightStrandAxis = 'xy' | 'xz' | 'yz';

export type SceneLightStrandWave = {
  kind: 'wave';
  curve: SceneLightStrandCurve;
};

export type SceneLightStrandCircle = {
  kind: 'circle';
  radius: number;
  axis?: LightStrandAxis;
  /** World-space position offset applied to the circle strand's geometric centre. */
  offset?: Vec3;
};

export type SceneLightStrandRectangle = {
  kind: 'rectangle';
  width: number;
  height: number;
  axis?: LightStrandAxis;
  /** World-space position offset applied to the rectangle strand's geometric centre. */
  offset?: Vec3;
};

export type SceneLightStrandShape =
  | SceneLightStrandWave
  | SceneLightStrandCircle
  | SceneLightStrandRectangle;

export type SceneLightStrand = {
  id: string;
  count: number;
  intensity: number;
  color: string;
  /** World-space position offset applied to the strand shape's origin. */
  position?: Vec3;
  distance?: number;
  decay?: number;
  shape: SceneLightStrandShape;
};

export type SceneLightSpot = {
  id?: string;
  intensity: number;
  color: string;
  /** World-space position of the spotlight source. */
  position: Vec3;
  /** World-space point the spotlight aims at. */
  target: Vec3;
  angle: number;
  penumbra: number;
  distance?: number;
  decay?: number;
};

export type SceneLightPanel = {
  id: string;
  /** World-space position of the top-left panel light (grid origin). */
  origin: Vec3;
  rows: number;
  cols: number;
  /** World-space step vector between adjacent panel lights in the grid. */
  spacing: Vec3;
  intensity: number;
  distance?: number;
  decay?: number;
  color?: string;
  matrix?: number[];
};

export type SceneLighting = {
  ambient: SceneLightAmbient;
  directionals: SceneLightDirectional[];
  glowPoint?: SceneLightGlowPoint;
  lightStrands?: SceneLightStrand[];
  points?: SceneLightPoint[];
  spots?: SceneLightSpot[];
  panels?: SceneLightPanel[];
  intensityScale: number;
  color: string;
};
