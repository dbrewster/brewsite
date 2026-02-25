/**
 * Lighting element types.
 */

export type Vec3 = [number, number, number];

export type SceneLightAmbient = {
  intensity: number;
  color: string;
};

export type SceneLightDirectional = {
  intensity: number;
  color: string;
  position: Vec3;
};

export type SceneLightPoint = {
  intensity: number;
  color: string;
  position: Vec3;
};

export type SceneLightSpot = {
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
  points?: SceneLightPoint[];
  spots?: SceneLightSpot[];
  panels?: SceneLightPanel[];
  intensityScale: number;
  color: string;
};
