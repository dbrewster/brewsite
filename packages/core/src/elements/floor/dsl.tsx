/**
 * Floor element DSL components.
 */

import type * as React from 'react';

export type FloorProps = {
  enabled?: boolean;
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
   * Floor surface definition.
   * Only `<FloorPhysical>` and `<FloorMirror>` children are compiled.
   * When `enabled` is true and no surface child is provided, no visible floor
   * surface will be produced.
   */
  children?: React.ReactNode;
};

export type FloorPhysicalProps = {
  textureUrl?: string;
  color?: string;
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
  mirrorResolution?: number;
  mirrorClipBias?: number;
  mirrorUseEnvironmentBackground?: boolean;
  mirrorEnvironmentIntensity?: number;
};

