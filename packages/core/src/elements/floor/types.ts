/**
 * Floor element types.
 */

export type FloorVariant = 'grid' | 'mirror' | 'physical';

export type FloorPlacement = 'origin' | 'sceneBase';
export type FloorNegativeZEdge = 'hard' | 'fade';

export type SceneFloor = {
  enabled: boolean;
  /**
   * Placement mode for resolving the floor Y origin.
   * - 'origin': floor Y uses world origin directly.
   * - 'sceneBase': floor Y snaps to the lowest visible scene geometry each frame.
   */
  placement?: FloorPlacement;
  /**
   * World-space position [x, y, z]. Typically [0, 0, 0].
   * Not NVS — these are raw Three.js world-space units, not [0..1] viewport fractions.
   * To co-locate the floor with a model placed at `nvsX`/`nvsY`, call
   * `nvsToWorldAnalytic()` from `@brewsite/core` to resolve the model's world position first.
   *
   * When `placement` is 'sceneBase', the y component is treated as an offset
   * from the resolved scene base Y.
   */
  position?: [number, number, number];
  rotation?: [number, number, number];
  /**
   * Rotation offset applied relative to the floor baseline orientation.
   * Baseline is [-Math.PI / 2, 0, 0] (horizontal plane).
   */
  rotationRelative?: [number, number, number];
  scale?: number;
  /**
   * Optional world-space reach in the negative Z direction from the floor origin.
   * When absent, the floor is unbounded by depth and uses full geometry extents.
   */
  negativeZExtent?: number;
  /**
   * Back-edge behavior when `negativeZExtent` is provided.
   * - 'hard': hard clip at back edge
   * - 'fade': alpha fade near the back edge
   */
  negativeZEdge?: FloorNegativeZEdge;
  /**
   * Fade distance in world units for `negativeZEdge='fade'`.
   * Defaults to an internal renderer heuristic when omitted.
   */
  negativeZFadeDistance?: number;
  surface?: FloorSurface;
};

export type FloorSurfacePhysical = {
  type: 'physical';
  /**
   * Built-in surface pattern. 'grid' generates a procedural grid over a physical
   * shadow-receiving floor.
   */
  pattern?: 'grid';
  /** Base fill color for the floor material. */
  textureUrl?: string;
  color?: string;
  /** Minor grid line color when pattern='grid'. */
  gridColor?: string;
  /** Major grid line color when pattern='grid'. */
  gridMajorColor?: string;
  /** World-unit minor grid cell size when pattern='grid'. */
  gridCellSize?: number;
  /** Number of minor cells per major line when pattern='grid'. */
  gridMajorEvery?: number;
  /** Grid line opacity [0-1] when pattern='grid'. */
  gridLineOpacity?: number;
  /** Grid fill opacity [0-1] when pattern='grid'. */
  gridFillOpacity?: number;
  opacity?: number;
  metalness?: number;
  roughness?: number;
  reflectivity?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  /** Ignored when pattern='grid' (grid floor is intentionally non-reflective). */
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
  /** Shadow-catcher opacity layered over the mirror. Default: 0.3. */
  shadowOpacity?: number;
  mirrorResolution?: number;
  mirrorClipBias?: number;
  mirrorUseEnvironmentBackground?: boolean;
  mirrorEnvironmentIntensity?: number;
};

export type FloorSurface = FloorSurfacePhysical | FloorSurfaceMirror;
