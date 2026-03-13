// SpotlightRig element types — interface contracts only.

/** XYZ world-space coordinate triple. */
export type Vec3Tuple = [number, number, number];

/**
 * Theming contract for SpotlightRig.
 *
 * All "reel" / cinematic settings live here AND on the DSL element.
 * Element-level props override corresponding theme values.
 * `count`, `showHelper`, and `center` are intentionally absent — they are element-only.
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
  /** World-space Y position of the target ground plane. */
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
 * Compiled runtime state for one SpotlightRig.
 * Flows through the SceneTrack and is sampled each tick by the RuntimeDriver.
 */
export type SpotlightRigState = SpotlightRigTheme & {
  /** World-space center of the circular orbit. Default: [0, 0, 0]. Element-only — not in theme. */
  center: Vec3Tuple;
  /**
   * World-space target point that all spotlights aim at. Default: null (each light targets straight down).
   * When set, all lights converge on this point regardless of their orbital position.
   */
  target: Vec3Tuple | null;
  /** Number of individual spotlights in the rig. Element-only — not interpolated. */
  count: number;
  /**
   * Whether to add Three.js SpotLightHelpers to the scene.
   * Element-only debug flag — not interpolated between scenes.
   * Only respected in development; ignored in production builds if desired.
   */
  showHelper: boolean;
  /**
   * Runtime enable gate — false when the widget is absent from the current scene.
   * Controlled by disableWhenAbsent = true on the widget.
   */
  enabled: boolean;
};
