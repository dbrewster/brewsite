/**
 * Lighting element DSL components.
 */

import type { ReactElement } from 'react';
import { isValidElement } from 'react';
import type { SceneLighting, Vec3 } from './types';

export type AmbientProps = {
  intensity: number;
  color: string;
};

export type DirectionalProps = {
  intensity: number;
  color: string;
  position: Vec3;
};

export type PointProps = {
  intensity: number;
  color: string;
  position: Vec3;
};

export type SpotProps = {
  intensity: number;
  color: string;
  position: Vec3;
  target: Vec3;
  angle: number;
  penumbra: number;
  distance?: number;
  decay?: number;
};

export type PanelProps = {
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

export type LightingProps = {
  intensityScale?: number;
  color?: string;
  children?: ReactElement | ReactElement[];
};

export const Lighting = (_props: LightingProps) => null;
export const Ambient = (_props: AmbientProps) => null;
export const Directional = (_props: DirectionalProps) => null;
export const Point = (_props: PointProps) => null;
export const Spot = (_props: SpotProps) => null;
export const Panel = (_props: PanelProps) => null;

Lighting.displayName = 'Lighting';
Ambient.displayName = 'Ambient';
Directional.displayName = 'Directional';
Point.displayName = 'Point';
Spot.displayName = 'Spot';
Panel.displayName = 'Panel';
