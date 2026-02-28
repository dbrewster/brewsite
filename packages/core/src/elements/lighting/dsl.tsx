/**
 * Lighting element DSL components.
 */

import type { ReactElement, ReactNode } from 'react';
import { isValidElement } from 'react';
import type { SceneSnapshotContext } from '../../compiler/sceneTypes';
import type { LightStrandAxis, SceneLighting, SceneLightStrandCurve, Vec3 } from './types';

type Resolvable<T> = T | ((context: SceneSnapshotContext) => T);

export type AmbientProps = {
  id?: string;
  intensity: Resolvable<number>;
  color: Resolvable<string>;
};

export type DirectionalProps = {
  id?: string;
  intensity: Resolvable<number>;
  color: Resolvable<string>;
  position: Resolvable<Vec3>;
};

export type PointProps = {
  id?: string;
  intensity: Resolvable<number>;
  color: Resolvable<string>;
  position: Resolvable<Vec3>;
};

export type GlowPointProps = {
  id?: string;
  intensity: Resolvable<number>;
  color: Resolvable<string>;
  position: Resolvable<Vec3>;
  distance?: Resolvable<number>;
  decay?: Resolvable<number>;
};

export type SpotProps = {
  id?: string;
  intensity: Resolvable<number>;
  color: Resolvable<string>;
  position: Resolvable<Vec3>;
  target: Resolvable<Vec3>;
  angle: Resolvable<number>;
  penumbra: Resolvable<number>;
  distance?: Resolvable<number>;
  decay?: Resolvable<number>;
};

export type LightStrandProps = {
  id: string;
  count: Resolvable<number>;
  intensity: Resolvable<number>;
  color: Resolvable<string>;
  position?: Resolvable<Vec3>;
  distance?: Resolvable<number>;
  decay?: Resolvable<number>;
  /**
   * Back-compat for existing LightStrand usage.
   * Equivalent to <Wave .../>.
   */
  curve?: Resolvable<SceneLightStrandCurve>;
  children?: ReactNode;
};

export type WaveProps = {
  length: Resolvable<number>;
  /** @deprecated Use length. */
  width?: Resolvable<number>;
  yOffset: Resolvable<number>;
  z: Resolvable<number>;
  waveAmplitude: Resolvable<number>;
  waveFrequency: Resolvable<number>;
  depthAmplitude: Resolvable<number>;
  depthFrequency: Resolvable<number>;
  depthPhase: Resolvable<number>;
};

export type CircleProps = {
  radius: Resolvable<number>;
  axis?: Resolvable<LightStrandAxis>;
  offset?: Resolvable<Vec3>;
};

export type RectangleProps = {
  width: Resolvable<number>;
  height: Resolvable<number>;
  axis?: Resolvable<LightStrandAxis>;
  offset?: Resolvable<Vec3>;
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
export const GlowPoint = (_props: GlowPointProps) => null;
export const Spot = (_props: SpotProps) => null;
export const LightStrand = (_props: LightStrandProps) => null;
export const Wave = (_props: WaveProps) => null;
export const Circle = (_props: CircleProps) => null;
export const Rectangle = (_props: RectangleProps) => null;
export const Panel = (_props: PanelProps) => null;

Lighting.displayName = 'Lighting';
Ambient.displayName = 'Ambient';
Directional.displayName = 'Directional';
Point.displayName = 'Point';
GlowPoint.displayName = 'GlowPoint';
Spot.displayName = 'Spot';
LightStrand.displayName = 'LightStrand';
Wave.displayName = 'Wave';
Circle.displayName = 'Circle';
Rectangle.displayName = 'Rectangle';
Panel.displayName = 'Panel';
