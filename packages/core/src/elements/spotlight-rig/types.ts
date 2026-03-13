// SpotlightRig element types — interface contracts only.

/** XYZ world-space coordinate triple. */
export type Vec3Tuple = [number, number, number];

/**
 * Custom orbit function for a single spotlight.
 * Receives wall-clock time in seconds, returns world-space [x, y, z] position
 * relative to the rig center.
 * Stored on the widget instance — not serialized into SceneTrack.
 */
export type OrbitFn = (wallTimeSeconds: number) => Vec3Tuple;

/**
 * Theming contract for SpotlightRig.
 *
 * All cinematic settings live here AND on the DSL element.
 * Element-level props override corresponding theme values.
 * `center`, `target`, `showHelper` are intentionally absent — they are element-only.
 *
 * @internal Use SpotlightRigPreset for the public API.
 */
export type SpotlightRigTheme = {
  /** CSS hex/rgb color string for the spotlight sources. */
  color: string;
  /** Peak intensity of each spotlight (physical units, same scale as Three.js SpotLight). */
  intensity: number;
  /** Rotation speed in radians per second. Negative = counter-clockwise. */
  speed: number;
  /** Radius of the circular sweep path in world units. */
  radius: number;
  /** World-space Y position of the spotlight source origins. */
  height: number;
  /** World-space Y position of the target ground plane (used when no per-light or rig-level target is set). */
  targetY: number;
  /** Spotlight cone half-angle in radians (Three.js SpotLight.angle). Max π/2. */
  angle: number;
  /** Penumbra falloff (0 = hard edge, 1 = fully soft edge). */
  penumbra: number;
  /** Physical distance decay exponent. Use 2.0 for physically-based rendering. */
  decay: number;
  /** Max light reach in world units. 0 = unlimited. */
  distance: number;
  /** Whether spotlights cast shadows. Shadow maps are expensive — disable for fill lights. */
  castShadow: boolean;
  /** Shadow map size in pixels (width and height). Must be a power of two. */
  shadowMapSize: number;
  /** Whether to render visible beam cone meshes. */
  showBeam: boolean;
  /** Opacity of the beam cone mesh (0 = invisible, 0.12 = subtle, 0.25 = dramatic). */
  beamOpacity: number;
  /** CSS color string for the beam cone mesh. Usually a lighter/whiter version of `color`. */
  beamColor: string;
  /** Whether to render a ground halo sprite at the spotlight target position. */
  showHalo: boolean;
  /** Opacity of the ground halo sprite. */
  haloOpacity: number;
  /** Diameter of the ground halo sprite in world units. */
  haloSize: number;
};

/**
 * Public API alias for SpotlightRigTheme.
 * Use this type when building and passing preset objects to SpotlightRig.
 */
export type SpotlightRigPreset = SpotlightRigTheme;

/**
 * Compiled runtime state for one individual spotlight within a SpotlightRig.
 * All properties are concrete resolved values — no Resolvable<T> here.
 *
 * `phase` and `orbit` are not part of SpotlightRigTheme because they are
 * per-light structural concerns, not visual theme values.
 */
export type SpotlightLightState = {
  /** Resolved light color. */
  color: string;
  /** Resolved intensity. */
  intensity: number;
  /** Radians per second for circular orbit. Negative = counter-clockwise. */
  speed: number;
  /** Radius of circular orbit in world units. */
  radius: number;
  /** World-space Y of the light source origin. */
  height: number;
  /** Y of the target ground plane (only used when no per-light target and no rig target). */
  targetY: number;
  /** Cone half-angle in radians. */
  angle: number;
  /** Penumbra softness (0–1). */
  penumbra: number;
  /** Decay exponent. */
  decay: number;
  /** Max reach in world units. */
  distance: number;
  /** Whether this light casts shadows. */
  castShadow: boolean;
  /** Shadow map size in pixels. */
  shadowMapSize: number;
  /** Whether the beam cone mesh is visible. */
  showBeam: boolean;
  /** Beam cone mesh opacity. */
  beamOpacity: number;
  /** Beam cone CSS color. */
  beamColor: string;
  /** Whether the ground halo is rendered. */
  showHalo: boolean;
  /** Halo sprite opacity. */
  haloOpacity: number;
  /** Halo sprite diameter in world units. */
  haloSize: number;
  /**
   * Explicit angular phase offset for circular orbit, in radians.
   * When provided, overrides the auto-distributed phase (2π × i / count).
   * Not part of the theme — structural per-light position control.
   */
  phase: number;
  /**
   * Per-light world-space target point override.
   * When null, falls back to the rig-level target, then targetY below the source.
   */
  target: Vec3Tuple | null;
};

/**
 * Compiled runtime state for one SpotlightRig.
 * Flows through the SceneTrack and is sampled each tick by the RuntimeDriver.
 *
 * `lights` replaces the old flat `SpotlightRigTheme` spread — each light is
 * fully resolved with its own color, intensity, speed, radius, etc.
 */
export type SpotlightRigState = {
  /** World-space center of the circular orbit. Default: [0, 0, 0]. Element-only — not in theme. */
  center: Vec3Tuple;
  /**
   * World-space rig-level target point. Fallback when a light has no per-light target.
   * When null and per-light target is also null, each light targets below itself at targetY.
   */
  target: Vec3Tuple | null;
  /**
   * Whether to add Three.js SpotLightHelpers to the scene.
   * Element-only debug flag — not interpolated between scenes.
   */
  showHelper: boolean;
  /**
   * Runtime enable gate — false when the widget is absent from the current scene.
   * Controlled by disableWhenAbsent = true on the widget.
   */
  enabled: boolean;
  /**
   * Per-light resolved states. Length determines the number of active spotlights.
   * Replaces the old `count` + flat theme approach.
   */
  lights: SpotlightLightState[];
};
