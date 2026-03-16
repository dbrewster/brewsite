// CarouselScrubber element types -- interface contracts only.

/**
 * Front-edge surface treatment style for the carousel tray.
 * Applied as vertex displacement on the front face (+Z) of the tray geometry.
 */
export type CarouselTrayEdgeStyle = 'smooth' | 'knurled' | 'ridged' | 'matte';

/**
 * Procedural surface pattern applied as a normal map to the carousel tray.
 *
 * - `'brushed'` — Fine parallel lines radiating from center. Anisotropic metallic look.
 * - `'radial'` — Concentric rings from center. Machined/turned metal look.
 * - `'crosshatch'` — Crossed diagonal lines. Knurled/textured feel.
 * - `'grain'` — Subtle random noise grain. Organic stone/onyx feel.
 * - `'none'` — No surface pattern. Clean flat material.
 */
export type CarouselTraySurfacePattern =
  | 'brushed'
  | 'radial'
  | 'crosshatch'
  | 'grain'
  | 'none';

/** Visual style configuration for the carousel scrubber. */
export type CarouselScrubberStyle = {
  /** Tray base color. Default: '#2C3E55'. */
  baseColor: string;
  /** Tray base opacity. Default: 0.6. */
  baseOpacity: number;
  /** Accent/highlight color for tray edge glow or future LAF elements. Default: '#5090e0'. */
  accentColor: string;
  /** Material metalness [0-1]. Default: 0.4. */
  metalness: number;
  /** Material roughness [0-1]. Default: 0.55. */
  roughness: number;
  /** Front-edge surface treatment. Default: 'knurled'. */
  edgeStyle: CarouselTrayEdgeStyle;
  /** Surface texture pattern. Default: 'brushed'. */
  surfacePattern: CarouselTraySurfacePattern;
  /** Surface texture intensity [0-1]. Default: 0.25. */
  surfaceIntensity: number;
  /** Optional URL to a custom normal map texture. Overrides surfacePattern when set. */
  surfaceMapUrl: string | null;
};

/** Compiled state for the 3D carousel scrubber. */
export type CarouselScrubberState = {
  /** ViewLayout ID this scrubber tracks. */
  layoutId: string;
  /** Current active index. */
  activeIndex: number;
  /** Total child count. */
  childCount: number;
  /** Whether the carousel loops. */
  loop: boolean;
  /** Visual style. */
  style: CarouselScrubberStyle;
  /** Whether to show the base platform. */
  showBase: boolean;
  /** Depth (thickness) of the tray in world units. Default: 0.36. */
  trayDepth: number;
  /** Gap between tray bottom edge and floor top in world units. Default: 0.02. */
  gap: number;
  /** NVS bounds of the carousel layout container. */
  nvsBounds: { x: number; y: number; w: number; h: number };
  /**
   * Actual NVS extent of all views in the carousel — the tight bounding box
   * around every resolved view rect. Used by render to compute tray position
   * (top Y from viewExtent bottom) and tray width (viewExtent width).
   *
   * Falls back to nvsBounds when not available (e.g., standalone scrubber).
   */
  viewExtent: { x: number; y: number; w: number; h: number };
  /** Carousel zStep -- used to compute ring center Z position and tray Z depth for ring carousels. */
  zStep: number;
  /** Carousel spread -- used to compute ring X radius for disc sizing (legacy compat). */
  spread: number;
};
