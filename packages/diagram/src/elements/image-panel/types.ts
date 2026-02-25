// Contract layer for the ImagePanel element. No runtime imports, no Three.js, no React.
// ImagePanel renders a STATIC IMAGE as a physical 3D floating frame.
// Fully WebGL — supports tilt, lighting, and MeshPhysicalMaterial gloss.
// For a live interactive website, use <Screen> instead.

/**
 * Bezel frame style for ImagePanel.
 * Identical to ScreenBezelVariant and BezelVariant in _shared/bezelGeometry.ts —
 * typed separately here to keep element types self-contained (no cross-element imports).
 * If the union ever diverges, update both types independently.
 */
export type ImagePanelBezelVariant = 'none' | 'thin' | 'dark' | 'light' | 'chrome';

/**
 * Fully resolved state for an ImagePanel element.
 * A static image texture displayed on a physical 3D plane with bezel and optional glow.
 * Produced by compileImagePanel() from ImagePanelDSL.
 */
export interface ImagePanelState {
  readonly id: string;

  /**
   * Public asset URL for the image (PNG, JPG, WebP).
   * Loaded via THREE.TextureLoader at render time.
   * Examples: '/screenshots/homepage.png', '/mockups/dashboard.jpg'
   */
  readonly src: string;

  /** World-space position of the panel center [x, y, z] */
  readonly position: readonly [number, number, number];

  /**
   * World-space rotation in radians [x, y, z] (Euler XYZ order).
   * Supports any rotation — this is pure WebGL.
   * A Y tilt of ~0.2 radians gives a natural perspective feel.
   */
  readonly rotation: readonly [number, number, number];

  /** Uniform scale applied to both panel and bezel. Default: 1 */
  readonly scale: number;

  /**
   * Panel display width in world units. Default: 12
   * Height is derived from the image's aspect ratio unless `height` is also provided.
   */
  readonly width: number;

  /**
   * Explicit panel height override in world units.
   * If undefined, height = width / imageAspectRatio (computed after texture loads).
   * Provide this when the aspect ratio is known at author time to avoid layout shift.
   */
  readonly height: number | undefined;

  /** Bezel frame visual style. Default: 'dark' */
  readonly bezel: ImagePanelBezelVariant;

  /**
   * Bezel border thickness in world units.
   * Default: 0.15 ('thin'), 0.35 ('dark' | 'light' | 'chrome'), 0 ('none').
   */
  readonly bezelThickness: number;

  /** Overall panel + bezel opacity [0–1]. Default: 1 */
  readonly opacity: number;

  /**
   * Screen surface gloss [0–1].
   * Implemented as THREE.MeshPhysicalMaterial clearcoat.
   * 0 = matte, 1 = mirror-like. Recommended: 0.4–0.7 for realistic screen appearance.
   * Default: 0.5
   */
  readonly gloss: number;

  /**
   * Clearcoat roughness [0–1]. Lower = sharper reflections.
   * Default: 0.05 (near-mirror clearcoat surface).
   */
  readonly glossRoughness: number;

  /**
   * Faint emissive self-illumination to simulate a lit screen.
   * Applied as MeshPhysicalMaterial.emissiveIntensity. Default: 0.15
   * Set to 0 for a non-illuminated image (e.g., a photograph, not a screen).
   */
  readonly selfIllumination: number;

  /**
   * Whether to render a glow halo around the panel edges.
   * Implemented as a THREE.Sprite with additive blending.
   * Default: true
   */
  readonly glow: boolean;

  /** CSS hex glow color. Default: '#88ccff' (cool blue-white for screen look) */
  readonly glowColor: string;

  /**
   * Glow size multiplier relative to panel size (1.0 = panel size).
   * Default: 1.4 — glow bleeds 40% beyond the panel edges.
   */
  readonly glowScale: number;

  /** Glow sprite opacity [0–1]. Default: 0.35 */
  readonly glowOpacity: number;

  /** Whether the panel is rendered. Allows hide/show via scene transitions. Default: true */
  readonly enabled: boolean;
}

/** Raw DSL props from <ImagePanel> before compile.ts applies defaults. */
export interface ImagePanelDSL {
  readonly id: string;
  readonly src: string;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly scale?: number;
  readonly width?: number;
  readonly height?: number;
  readonly bezel?: ImagePanelBezelVariant;
  readonly bezelThickness?: number;
  readonly opacity?: number;
  readonly gloss?: number;
  readonly glossRoughness?: number;
  readonly selfIllumination?: number;
  readonly glow?: boolean;
  readonly glowColor?: string;
  readonly glowScale?: number;
  readonly glowOpacity?: number;
  readonly enabled?: boolean;
}
