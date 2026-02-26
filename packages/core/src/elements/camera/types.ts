// Camera element — pure type contracts. No runtime or Three.js imports.

/** 3-element tuple for world-space coordinates. */
export type Vec3 = [number, number, number];

/** Mouse button identifier for interaction bindings. */
export type MouseButton = 'left' | 'middle' | 'right';

/** Keyboard modifier keys. */
export type ModifierKey = 'alt' | 'ctrl' | 'meta' | 'shift';

/** A keyboard shortcut combo. */
export type KeyCombo = {
  /** Key value per KeyboardEvent.key (e.g. 'ArrowRight', 'r', 'Escape'). */
  key: string;
  modifiers?: ModifierKey[];
};

// ─── Positioning Descriptors ────────────────────────────────────────────────

/**
 * Explicit world-space camera: position and look-at target both in world coords.
 * Most precise; use for diagrams and layout-sensitive scenes.
 */
export type WorldSpaceCamera = {
  mode: 'world';
  /** Camera position in world space. */
  position: Vec3;
  /** Point the camera looks at. */
  target: Vec3;
  /** Up vector, default [0, 1, 0]. */
  up?: Vec3;
};

/**
 * Orbital camera: expressed as spherical coordinates around a target point.
 * Good for "turntable" views and scenes that rotate the camera around a subject.
 */
export type OrbitCamera = {
  mode: 'orbit';
  /** Orbit center in world space. */
  target: Vec3;
  /** Horizontal angle in radians (0 = +Z axis, positive = counter-clockwise). */
  azimuth: number;
  /** Vertical angle from horizontal plane in radians (0 = equator, +PI/2 = top). */
  polar: number;
  /** Distance from target in world units. */
  distance: number;
  /** Up vector, default [0, 1, 0]. */
  up?: Vec3;
};

/**
 * Auto-frame: positions camera to frame a target model at a given height.
 * Preserved from v1 for backward compatibility.
 */
export type FitBotHeightCamera = {
  mode: 'fitBotHeight';
  /** Widget ID of the model to frame. */
  targetId: string;
  /** Target object height at scale=1 in world units. */
  targetHeight: number;
  /** Portion of viewport height the target should occupy (0..1). Default 0.4. */
  framingHeightPct?: number;
  /** Camera Y offset relative to target position. Default 0. */
  heightOffset?: number;
  /** Additional distance added to computed camera distance. Default 0. */
  distanceOffset?: number;
};

/**
 * Auto-frame: positions camera to frame a floor Z span in view.
 * Preserved from v1 for backward compatibility.
 */
export type FitFloorDepthCamera = {
  mode: 'fitFloorDepth';
  floorY: number;
  floorZMin: number;
  floorZMax: number;
  lookAtZ?: number;
  cameraX?: number;
  cameraY?: number;
};

/** All positioning descriptor variants. */
export type CameraPositionDescriptor =
  | WorldSpaceCamera
  | OrbitCamera
  | FitBotHeightCamera
  | FitFloorDepthCamera;

// ─── Lens / Optics ──────────────────────────────────────────────────────────

// Phase 2 (deferred): DofConfig and full bokeh post-processing via EffectComposer.
// Implementing DoF requires calling composer.render() instead of renderer.render()
// which is a runtime loop change out of scope for this plan. The type is reserved
// here as a placeholder so scene authors can wire it up in a future phase without
// a breaking change to SceneCamera.
export type DofConfig = never; // Phase 2 — not yet implemented

/**
 * Lens properties for the Three.js PerspectiveCamera.
 * All are optional; undefined means "use Three.js defaults".
 */
export type CameraLens = {
  /** Vertical field of view in degrees. Default 45. */
  fov?: number;
  /**
   * Focal length in millimetres relative to filmGauge.
   * If set, overrides fov. 50mm on 35mm film ≈ 39.6° FOV.
   */
  focalLength?: number;
  /** Film gauge in mm. Default 35. Affects focalLength computation. */
  filmGauge?: number;
  /** Near clip plane in world units. Default 0.1. */
  near?: number;
  /** Far clip plane in world units. Default 2000. */
  far?: number;
};

/**
 * Rendering properties applied directly to the WebGLRenderer each tick.
 * Phase 2 will extend this with DoF/bokeh via EffectComposer.
 */
export type CameraPost = {
  /**
   * Renderer tone-mapping exposure multiplier.
   * Applied as renderer.toneMappingExposure. Default 1.0.
   * The renderer reference is read from scene.userData['__brewsite_renderer'].
   */
  exposure?: number;
  // dof?: DofConfig;  ← Phase 2: deferred
};

// ─── Interactive Camera Control ──────────────────────────────────────────────

/**
 * Per-axis interaction override.
 * Setting to false disables the action entirely.
 */
export type PointerAction = {
  /** Which mouse button triggers this action. */
  pointer?: MouseButton;
  /** Required keyboard modifiers (all must be held). */
  modifiers?: ModifierKey[];
  /** Number of touch fingers (for touch devices). */
  touchFingers?: number;
} | false;

/**
 * Camera interaction configuration embedded in SceneCamera.
 * When enabled, camera-controls takes over input on the canvas element.
 * Scene-defined camera position is saved and can be restored via reset.
 */
export type CameraInteractionConfig = {
  /** Whether interactive camera control is active for this scene. Default false. */
  enabled: boolean;

  /**
   * Orbit (rotate around target).
   * Default: left-click drag, single-finger touch.
   */
  orbit?: PointerAction;

  /**
   * Pan (truck/pedestal — translate camera and target together).
   * Default: right-click drag, two-finger touch drag.
   */
  pan?: PointerAction;

  /**
   * Dolly (zoom — change distance to target).
   * wheel: true = enable mouse-wheel dolly.
   * pinch: true = enable pinch-to-zoom (touch).
   */
  dolly?: {
    wheel?: boolean;
    pinch?: boolean;
    wheelModifiers?: ModifierKey[];
  } | false;

  /** Keyboard shortcut to reset camera to scene-defined position. Default { key: 'r' }. */
  reset?: KeyCombo;

  /**
   * Whether to smoothly return the camera to the scene-defined position when
   * the scene index changes (i.e. the user scrolls to a new scene while in
   * interaction mode). Default true.
   *
   * The reset is animated — camera-controls.setLookAt(..., enableTransition=true)
   * is called so the camera glides back rather than snapping. The duration is
   * governed by camera-controls' internal smoothTime (~0.25s with default damping).
   *
   * Set to false if you want the user's camera position to persist across
   * scene transitions (e.g. a continuous multi-scene diagram).
   */
  resetOnSceneChange?: boolean;

  // ─── Constraints ─────────────────────────────────────────────────────────
  minDistance?: number;
  maxDistance?: number;
  /** Minimum polar angle from top (radians). Default 0. */
  minPolarAngle?: number;
  /** Maximum polar angle from top (radians). Default Math.PI. */
  maxPolarAngle?: number;
  minAzimuthAngle?: number;
  maxAzimuthAngle?: number;

  // ─── Feel ─────────────────────────────────────────────────────────────────
  /**
   * Inertia/damping coefficient. true = 0.05 default.
   * Higher = more inertia. 0 = no inertia.
   */
  damping?: boolean | number;
  orbitSpeed?: number;
  panSpeed?: number;
  dollySpeed?: number;
};

// ─── Transition Interpolation ────────────────────────────────────────────────

/**
 * Easing function names for camera transitions.
 * These correspond to the easing functions available in timeline/math.ts.
 */
export type EaseFnName =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'smoothstep';

/**
 * Camera transition interpolation descriptor.
 * Controls how the camera moves between two SceneCamera states during a scene transition.
 */
export type CameraTransitionInterpolation =
  | {
      type: 'linear';
    }
  | {
      type: 'eased';
      ease: EaseFnName;
    }
  | {
      /**
       * Camera position follows a cubic bezier path through world space.
       * p0 = fromPosition, p3 = toPosition.
       * cp1 and cp2 are intermediate control points in world coords.
       */
      type: 'bezier';
      cp1: Vec3;
      cp2: Vec3;
      ease?: EaseFnName;
    }
  | {
      /**
       * Camera orbits around its target point while interpolating.
       * Both azimuth and polar are spherically interpolated.
       * Best for "rotate around subject" transitions.
       */
      type: 'orbit';
      ease?: EaseFnName;
    }
  | {
      /**
       * Camera follows a CatmullRom spline through the given waypoints.
       * First waypoint = fromPosition, last waypoint = toPosition.
       * Intermediate waypoints shape the curve.
       */
      type: 'path';
      waypoints: Vec3[];
      ease?: EaseFnName;
    };

// ─── Unified SceneCamera ────────────────────────────────────────────────────

/**
 * The complete scene camera state compiled into each SceneTrackTick.
 * This is what lives in tick.state.widgets['camera'].
 *
 * v1 compatibility: the 'fitBotHeight' and 'fitFloorDepth' modes are still
 * supported and behave identically to the original implementation.
 */
export type SceneCamera = {
  /** Whether this camera descriptor is active. false = use Three.js defaults. */
  enabled: boolean;

  /** Positioning descriptor. Determines how camera position/orientation are computed. */
  descriptor: CameraPositionDescriptor;

  /** Lens and projection settings. */
  lens?: CameraLens;

  /** Post-processing and rendering settings. */
  post?: CameraPost;

  /** Interactive camera control for this scene. */
  interaction?: CameraInteractionConfig;

  /**
   * Interpolation mode for this camera when transitioning INTO this scene.
   * Overrides the default linear blend in functionalCameraTransitionSpec.
   */
  transitionIn?: CameraTransitionInterpolation;
};
