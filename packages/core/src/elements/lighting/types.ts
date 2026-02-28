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
  position: Vec3;
};

export type SceneLightPoint = {
  id?: string;
  intensity: number;
  color: string;
  position: Vec3;
};

export type SceneLightGlowPoint = {
  id?: string;
  intensity: number;
  color: string;
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
  offset?: Vec3;
};

export type SceneLightStrandRectangle = {
  kind: 'rectangle';
  width: number;
  height: number;
  axis?: LightStrandAxis;
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
  position?: Vec3;
  distance?: number;
  decay?: number;
  shape: SceneLightStrandShape;
};

export type SceneLightSpot = {
  id?: string;
  intensity: number;
  color: string;
  position: Vec3;
  target: Vec3;
  angle: number;
  penumbra: number;
  distance?: number;
  decay?: number;
};

export type SceneLightPanel = {
  id: string;
  origin: Vec3;
  rows: number;
  cols: number;
  spacing: Vec3;
  intensity: number;
  distance?: number;
  decay?: number;
  color?: string;
  matrix?: number[];
};

export type SceneLighting = {
  ambient: SceneLightAmbient;
  directional: SceneLightDirectional;
  glowPoint?: SceneLightGlowPoint;
  lightStrands?: SceneLightStrand[];
  points?: SceneLightPoint[];
  spots?: SceneLightSpot[];
  panels?: SceneLightPanel[];
  intensityScale: number;
  color: string;
};
