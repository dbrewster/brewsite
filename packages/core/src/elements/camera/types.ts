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

// ─── Interactive Camera Control (Modifier-Key Model) ─────────────────────────

/**
 * Per-axis speed tuning for a camera interaction binding.
 * `speed` multiplies the pixel-to-world delta. Default 1.0.
 */
export type CameraAxisConfig = {
  /** Multiplier applied to pixel delta when computing the camera movement. Default 1.0. */
  speed?: number;
};

/**
 * Trackpad / mouse interaction configuration.
 *
 * Modifier-key bindings (all use left-button drag or one-finger trackpad drag):
 *   Ctrl  + drag → orbit (rotate around target)
 *   Cmd   + drag → orbit (rotate around target) [macOS]
 *   Shift + drag → pan   (translate camera + target in screen space)
 *   Alt   + drag → dolly (change distance to target)
 *
 * Wheel bindings:
 *   Shift + wheel → pan   (translate camera + target in screen space)
 *   Cmd   + wheel → orbit (rotate around target) [macOS]
 *   Alt   + wheel → dolly (when wheelZoom: true)
 *
 * No modifier key held → drag does nothing (avoids conflicting with page scroll).
 */
export type TrackpadCameraConfig = {
  /** Whether interactive control is active for this scene. Default: false */
  enabled: boolean;

  /**
   * Ctrl + drag = orbit/rotate.
   * false disables this binding. Object form sets speed. Default: enabled.
   */
  rotate?: boolean | CameraAxisConfig;

  /**
   * Shift + drag = pan/truck (translate camera + target together).
   * false disables this binding. Object form sets speed. Default: enabled.
   */
  pan?: boolean | CameraAxisConfig;

  /**
   * Alt + drag = dolly/zoom (change distance to target).
   * false disables this binding. Object form sets speed. Default: enabled.
   */
  zoom?: boolean | CameraAxisConfig;

  /**
   * Alt + scroll wheel also dolly/zooms.
   * When true, the driver returns claimsWheel()=false — only Alt-modified
   * wheel events are intercepted; regular wheel still reaches scene navigation.
   * Default: false.
   */
  wheelZoom?: boolean;

  /**
   * Inertia/damping in seconds. Applies to all axes.
   * false = no inertia (instant response).
   * Default: 0.25s.
   */
  damping?: number | false;

  /** Minimum camera distance from target. */
  minDistance?: number;
  /** Maximum camera distance from target. */
  maxDistance?: number;
  /** Minimum polar angle (radians from top). Default 0. */
  minPolarAngle?: number;
  /** Maximum polar angle (radians from top). Default Math.PI. */
  maxPolarAngle?: number;

  /**
   * Keyboard shortcut to reset camera to scene-defined position.
   * false disables the reset shortcut.
   * Default: { key: 'r' }.
   */
  reset?: KeyCombo | false;

  /**
   * When true, camera smoothly resets to scene-defined position when the
   * scene index changes (user scrolls to a new scene). Default: true.
   */
  resetOnSceneChange?: boolean;
};

/**
 * Abstraction over camera interaction backends.
 * Production implementation: CameraControlsDriver (in render.ts, uses camera-controls).
 * Test implementation: FakeInteractionDriver (in __tests__/, plain class, no Three.js).
 *
 * The `cameraObject` parameter is typed as `unknown` to keep this interface free of
 * Three.js imports. Implementors cast to THREE.PerspectiveCamera internally.
 *
 * All methods take and return only plain types (Vec3, numbers, booleans, HTMLElement).
 */
export interface ICameraInteractionDriver {
  /**
   * Attach the driver to a camera and DOM element. Called once when entering
   * interaction mode. Implementations add their own event listeners here.
   */
  attach(cameraObject: unknown, domElement: HTMLElement, config: TrackpadCameraConfig): void;

  /**
   * Sync the driver's internal look-at state to world-space position and target.
   * Called when interaction mode is first entered (snap) and on smooth reset.
   * `smooth=false` → instant snap. `smooth=true` → animated glide.
   */
  setLookAt(position: Vec3, target: Vec3, smooth: boolean): void;

  /**
   * Advance the driver by deltaSeconds for damping/inertia computation.
   * Must be called every frame while interaction is active.
   * Returns true if the camera moved this frame (used for dirty-checking, optional).
   */
  update(deltaSeconds: number): boolean;

  /**
   * Apply new configuration (speeds, constraints, damping) without re-attaching.
   * Called every tick while interaction is active to pick up scene-state changes.
   */
  configure(config: TrackpadCameraConfig): void;

  /**
   * Returns true when this driver intends to claim ALL wheel events, suppressing
   * scene navigation. Used by useSceneEngine's wheelGuard.
   *
   * NOTE: When wheelZoom is false (default), this returns false. The driver still
   * handles Alt+wheel internally (since scene nav's modifiersMatch() ignores
   * modifier-held events by default), without claiming unmodified wheel.
   */
  claimsWheel(): boolean;

  /**
   * Detach all DOM listeners and release internal state.
   * Called when exiting interaction mode or when CameraWidget is disposed.
   */
  dispose(): void;
}

/**
 * Factory function that creates an ICameraInteractionDriver, attaches it, and returns it.
 * Injected into CameraWidget. Production default uses CameraControlsDriver from render.ts.
 * Tests inject a FakeInteractionDriver factory.
 */
export type CameraInteractionDriverFactory = (
  cameraObject: unknown,
  domElement: HTMLElement,
  config: TrackpadCameraConfig,
) => ICameraInteractionDriver;

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
  interaction?: TrackpadCameraConfig;

  /**
   * Interpolation mode for this camera when transitioning INTO this scene.
   * Overrides the default linear blend in functionalCameraTransitionSpec.
   */
  transitionIn?: CameraTransitionInterpolation;
};

export type CameraOverrideState = {
  enabled: boolean;
  position: Vec3;
  target: Vec3;
  up?: Vec3;
  fov?: number;
  near?: number;
  far?: number;
  exposure?: number;
};
