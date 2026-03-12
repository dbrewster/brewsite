/**
 * Floor element DSL components.
 */

import type * as React from 'react';
import type { FloorNegativeZEdge, FloorPlacement, FloorVariant } from './types';
import type { SceneTheme } from '../../theme/types';

export type FloorProps = {
  enabled?: boolean;
  /** Optional SceneTheme to derive grid-floor tokens from. */
  theme?: SceneTheme;
  /**
   * Quick surface preset.
   * - 'grid' (default): physical floor with procedural grid + shadows
   * - 'mirror': reflection floor + shadows
   * - 'physical': plain physical floor + shadows
   *
   * A `<FloorPhysical>` or `<FloorMirror>` child, when provided, overrides this preset.
   */
  variant?: FloorVariant;
  /**
   * Floor Y-origin placement strategy.
   * - 'origin': use world origin (legacy behavior for authored <Floor> nodes)
   * - 'sceneBase': snap to lowest visible scene geometry each frame
   */
  placement?: FloorPlacement;
  /**
   * World-space position [x, y, z]. Typically [0, 0, 0] — the floor sits at the scene origin.
   * Not NVS — values are raw Three.js world-space units.
   * To co-locate with a model at `nvsX`/`nvsY`, use `nvsToWorldAnalytic()` from
   * `@brewsite/core` to resolve the model's world position before setting this field.
   */
  position?: [number, number, number];
  /**
   * Absolute world rotation in radians.
   */
  rotation?: [number, number, number];
  /**
   * Rotation offset in radians relative to floor baseline [-Math.PI / 2, 0, 0].
   * Use this for subtle floor tilt without manually subtracting PI/2 on X.
   */
  rotationRelative?: [number, number, number];
  scale?: number;
  /**
   * Optional world-space reach in the negative Z direction from the floor origin.
   * When omitted, depth is unbounded.
   */
  negativeZExtent?: number;
  /**
   * Back-edge behavior for `negativeZExtent`.
   * - 'hard': clip at the edge
   * - 'fade': alpha fade to transparent at the edge
   */
  negativeZEdge?: FloorNegativeZEdge;
  /**
   * World-space fade distance for `negativeZEdge='fade'`.
   * Uses an internal default when omitted.
   */
  negativeZFadeDistance?: number;
  /**
   * Floor surface definition.
   * Only `<FloorPhysical>` and `<FloorMirror>` children are compiled.
   * When `enabled` is true and no surface child is provided, no visible floor
   * surface will be produced.
   */
  children?: React.ReactNode;
};

export type FloorPhysicalProps = {
  pattern?: 'grid';
  textureUrl?: string;
  color?: string;
  gridColor?: string;
  gridMajorColor?: string;
  gridCellSize?: number;
  gridMajorEvery?: number;
  gridLineOpacity?: number;
  gridFillOpacity?: number;
  opacity?: number;
  metalness?: number;
  roughness?: number;
  reflectivity?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  envMapIntensity?: number;
  textureRepeat?: [number, number];
  textureOffset?: [number, number];
  textureRotation?: number;
  normalMapUrl?: string;
  normalScale?: [number, number];
  roughnessMapUrl?: string;
  metalnessMapUrl?: string;
  aoMapUrl?: string;
  aoMapIntensity?: number;
  displacementMapUrl?: string;
  displacementScale?: number;
  displacementBias?: number;
  alphaMapUrl?: string;
  emissiveMapUrl?: string;
  wireframe?: boolean;
};

export type FloorMirrorProps = {
  mirrorColor?: string;
  mirrorOpacity?: number;
  shadowOpacity?: number;
  mirrorResolution?: number;
  mirrorClipBias?: number;
  mirrorUseEnvironmentBackground?: boolean;
  mirrorEnvironmentIntensity?: number;
};
