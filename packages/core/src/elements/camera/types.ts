/**
 * Camera element types.
 */

export type CameraMode = 'fitBotHeight' | 'fitFloorDepth';

export type SceneCamera = {
  enabled: boolean;
  mode: CameraMode;
  /** Optional override for camera vertical FOV (degrees). */
  fov?: number;

  // ─── Fit bot height (frame target in view) ───────────────────────────────
  targetId?: string;
  /** Target height at scale=1 in world units. */
  targetHeight?: number;
  /** Portion of viewport height the target should occupy (0..1). */
  framingHeightPct?: number;
  /** Camera Y offset relative to target position. */
  heightOffset?: number;
  /** Additional distance added to computed camera distance. */
  distanceOffset?: number;

  // ─── Fit floor depth (frame floor Z span in view) ────────────────────────
  floorY?: number;
  floorZMin?: number;
  floorZMax?: number;
  lookAtZ?: number;
  cameraX?: number;
  cameraY?: number;
};
