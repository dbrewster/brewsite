/**
 * Floor element DSL components.
 */

import type * as React from 'react';

export type FloorProps = {
  enabled?: boolean;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  children?: React.ReactNode;
};

export const Floor = (_props: FloorProps) => null;

Floor.displayName = 'Floor';

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

export const FloorPhysical = (_props: FloorPhysicalProps) => null;
FloorPhysical.displayName = 'FloorPhysical';

export type FloorMirrorProps = {
  mirrorColor?: string;
  mirrorOpacity?: number;
  mirrorResolution?: number;
  mirrorClipBias?: number;
  mirrorUseEnvironmentBackground?: boolean;
  mirrorEnvironmentIntensity?: number;
};

export const FloorMirror = (_props: FloorMirrorProps) => null;
FloorMirror.displayName = 'FloorMirror';
