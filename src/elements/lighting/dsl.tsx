/**
 * Lighting element DSL components.
 */

import type { ReactElement } from 'react';
import { isValidElement } from 'react';
import type { SceneSnapshotContext } from '../../compiler/sceneTypes';
import type { SceneLighting, Vec3 } from './types';

type Resolvable<T> = T | ((context: SceneSnapshotContext) => T);

export type AmbientProps = {
  intensity: Resolvable<number>;
  color: Resolvable<string>;
};

export type DirectionalProps = {
  intensity: Resolvable<number>;
  color: Resolvable<string>;
  position: Resolvable<Vec3>;
};

export type PointProps = {
  intensity: Resolvable<number>;
  color: Resolvable<string>;
  position: Resolvable<Vec3>;
};

export type SpotProps = {
  intensity: Resolvable<number>;
  color: Resolvable<string>;
  position: Resolvable<Vec3>;
  target: Resolvable<Vec3>;
  angle: Resolvable<number>;
  penumbra: Resolvable<number>;
  distance?: Resolvable<number>;
  decay?: Resolvable<number>;
};

export type PanelProps = {
  id: string;
  origin: Resolvable<Vec3>;
  rows: Resolvable<number>;
  cols: Resolvable<number>;
  spacing: Resolvable<Vec3>;
  intensity: Resolvable<number>;
  distance?: Resolvable<number>;
  decay?: Resolvable<number>;
  color?: Resolvable<string>;
  matrix?: Resolvable<number[]>;
};

export type LightingProps = {
  intensityScale?: Resolvable<number>;
  color?: Resolvable<string>;
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
