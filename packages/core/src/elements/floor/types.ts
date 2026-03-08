/**
 * Floor element types.
 */

export type SceneFloor = {
  enabled: boolean;
  /**
   * World-space position [x, y, z]. Typically [0, 0, 0].
   * Not NVS — these are raw Three.js world-space units, not [0..1] viewport fractions.
   * To co-locate the floor with a model placed at `nvsX`/`nvsY`, call
   * `nvsToWorldAnalytic()` from `@brewsite/core` to resolve the model's world position first.
   */
  position?: [number, number, number];
  rotation?: [number, number, number];
  /**
   * Rotation offset applied relative to the floor baseline orientation.
   * Baseline is [-Math.PI / 2, 0, 0] (horizontal plane).
   */
  rotationRelative?: [number, number, number];
  scale?: number;
  surface?: FloorSurface;
};

export type FloorSurfacePhysical = {
  type: 'physical';
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

export type FloorSurfaceMirror = {
  type: 'mirror';
  mirrorColor?: string;
  mirrorOpacity?: number;
  mirrorResolution?: number;
  mirrorClipBias?: number;
  mirrorUseEnvironmentBackground?: boolean;
  mirrorEnvironmentIntensity?: number;
};

export type FloorSurface = FloorSurfacePhysical | FloorSurfaceMirror;
