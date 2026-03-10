// Camera DSL component — authoring surface. No Three.js. No runtime imports.

import type {
  Vec3,
  CameraLens,
  CameraPost,
  TrackpadCameraConfig,
  CameraTransitionInterpolation,
} from './types';

// ─── Flat authoring props ─────────────────────────────────────────────────

/**
 * World-space camera props.
 * Use when you want explicit control of position and target.
 */
export type WorldCameraProps = {
  mode: 'world';
  position: Vec3;
  target: Vec3;
  up?: Vec3;
};

/**
 * Orbital camera props.
 * Use for turntable views or rotate-around-subject transitions.
 */
export type OrbitCameraProps = {
  mode: 'orbit';
  target: Vec3;
  /** Horizontal angle in radians. 0 = +Z facing. */
  azimuth: number;
  /** Vertical angle from equator in radians. 0 = level, +PI/2 = top-down. */
  polar: number;
  /** Distance from target in world units. */
  distance: number;
  up?: Vec3;
};

/**
 * Auto-framing camera that fits the target model's height within the viewport.
 *
 * Transition limitation: Transitioning between fitBotHeight and world/orbit
 * cameras produces a hard cut at the midpoint - not a smooth interpolation.
 * This is because the world-space position is resolved at render time, not compile time.
 * For smooth camera transitions across modes, use world or orbit on both ends.
 */
export type FitBotHeightCameraProps = {
  mode: 'fitBotHeight';
  targetId: string;
  targetHeight: number;
  framingHeightPct?: number;
  heightOffset?: number;
  distanceOffset?: number;
};

/** Legacy fitFloorDepth props for backward compatibility. */
export type FitFloorDepthCameraProps = {
  mode: 'fitFloorDepth';
  floorY: number;
  floorZMin: number;
  floorZMax: number;
  lookAtZ?: number;
  cameraX?: number;
  cameraY?: number;
};

/**
 * NVS-viewport camera props.
 *
 * Provides a principled, NVS-aligned camera setup for scenes without 3D models.
 * The author declares two independent parameters; the compiler derives all camera
 * primitives (position, near, far, fov) from them.
 *
 * With defaults (worldScale=10, zRange=5): cameraZ≈12.07, visibleWorldHeight=10,
 * visibleWorldWidth≈17.78 at 16:9, visible Z range z ∈ [-2.5, +2.5].
 */
export type NvsViewportCameraProps = {
  mode: 'nvsViewport';
  /**
   * How many world units the NVS vertical span [0..1] covers at z=0.
   * Controls world scale and camera distance. Default: 10.
   */
  worldScale?: number;
  /**
   * Total visible Z depth, centered on z=0. Content from z=-(zRange/2) to
   * z=+(zRange/2) is visible. Default: worldScale / 2.
   */
  zRange?: number;
};

export type CameraDescriptorProps =
  | WorldCameraProps
  | OrbitCameraProps
  | FitBotHeightCameraProps
  | FitFloorDepthCameraProps
  | NvsViewportCameraProps;

/**
 * Full Camera DSL props. Combine a positioning descriptor with optional lens,
 * post-processing, and interaction configuration.
 *
 * When absent from a scene: the camera holds its last rendered position from the
 * previous scene. It does not reset to a default position.
 */
export type CameraProps = CameraDescriptorProps & {
  // Lens (flat, maps to CameraLens)
  fov?: CameraLens['fov'];
  focalLength?: CameraLens['focalLength'];
  filmGauge?: CameraLens['filmGauge'];
  near?: CameraLens['near'];
  far?: CameraLens['far'];
  // Post (flat, maps to CameraPost) — DoF is Phase 2
  exposure?: CameraPost['exposure'];
  // Interaction
  interaction?: TrackpadCameraConfig;
  // Transition
  transitionIn?: CameraTransitionInterpolation;
};

