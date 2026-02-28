/**
 * Lighting element DSL components.
 */

import type { ReactNode } from 'react';
import type { SceneSnapshotContext } from '../../compiler/sceneTypes';
import type { LightStrandAxis, SceneLightStrandCurve, Vec3 } from './types';

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

/**
 * A standard Three.js PointLight that illuminates nearby geometry.
 *
 * Participates in shadow casting and material interactions (specular, diffuse).
 * More GPU-expensive than <GlowPoint>.
 *
 * Use when you need real scene illumination. For a visual glow effect without
 * lighting cost, use <GlowPoint> instead.
 */
export type PointProps = {
  id?: string;
  intensity: Resolvable<number>;
  color: Resolvable<string>;
  position: Resolvable<Vec3>;
};

/**
 * A sprite-based pseudo-light that renders as a visible glowing orb.
 *
 * Does NOT illuminate surfaces, cast shadows, or participate in material PBR calculations.
 * It is a visual effect only - a billboard sprite with a glow texture.
 *
 * Use for decorative light sources, UI indicators, or ambient atmosphere effects where
 * performance matters. For actual scene illumination, use <Point> instead.
 */
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
   * @deprecated Use <Wave>, <Circle>, or <Rectangle> as children instead.
   * The child-component API is more expressive and composable. This prop will be
   * removed in a future major version.
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
  /** Lighting sub-elements: <Ambient>, <Directional>, <Point>, <GlowPoint>, <Spot>, <LightStrand>, <Panel>. */
  children?: ReactNode;
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
