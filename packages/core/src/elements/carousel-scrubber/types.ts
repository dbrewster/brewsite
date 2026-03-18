// CarouselScrubber element types -- interface contracts only.

import type { MaterialApplication } from '../../widget/materialTypes';

/**
 * Highlight mode for a view on the carousel tray.
 * 'glow'        — Flat emissive rectangle in XZ plane above the tray.
 * 'holographic' — Vertical volumetric beam + optional smoke ring.
 * 'none'        — No highlight (default).
 */
export type ViewHighlightMode = 'glow' | 'holographic' | 'none';

/**
 * External highlight configuration for a single view.
 * Used in the DSL `highlights` array prop and the programmatic API.
 * Unlike ViewHighlight, this doesn't carry internal fields (bounds, followView).
 */
export type ViewHighlightConfig = {
  /** View ID to highlight. */
  readonly viewId: string;
  /**
   * Semantic variant name — resolves all visual params from the theme's
   * highlightPalette. Explicit fields (color, mode, etc.) override the
   * variant values.
   *
   * @example { viewId: 'chart-1', variant: 'error' }
   * @example { viewId: 'chart-1', variant: 'primary', intensity: 0.9 }
   */
  readonly variant?: import('../../theme/types').HighlightVariantName;
  /** Highlight mode. Default: 'glow'. */
  readonly mode?: ViewHighlightMode;
  /** Highlight color. */
  readonly color?: string;
  /** Intensity [0-1]. */
  readonly intensity?: number;
  /** Beam height in world units (holographic only). */
  readonly beamHeight?: number;
  /** Enable smoke particles (holographic only). Default: false. */
  readonly smoke?: boolean;
  /** Enable volumetric dust motes in the beam (holographic only). Default: false. */
  readonly dust?: boolean;
  /** Z offset in world units. Negative = push back. */
  readonly zOffset?: number;
  /** Backdrop opacity [0-1]. Dims neighboring views behind the beam. 0 = no backdrop. Default: 0.2. */
  readonly backdropOpacity?: number;
  /**
   * Backdrop color. Tints the semi-transparent backdrop cylinder.
   * Auto-resolved from blendMode/polarity when not set.
   */
  readonly backdropColor?: string;
  /**
   * Blending mode. Auto-resolved from scene colorMode when not set.
   * 'additive' — bright glow on dark backgrounds (default for dark scenes).
   * 'normal'   — tinted shadow on light backgrounds (default for light scenes).
   */
  readonly blendMode?: 'additive' | 'normal';
};

/**
 * Per-view highlight configuration. One entry per carousel child view.
 * Built at compile time from DSL props + theme defaults.
 */
export type ViewHighlight = {
  /** View widget ID this highlight targets. */
  readonly viewId: string;
  /** NVS bounds of the view (copied from ViewState.bounds). */
  readonly bounds: { x: number; y: number; w: number; h: number };
  /** Highlight mode. Default: 'none'. */
  readonly mode: ViewHighlightMode;
  /** Highlight color. Falls through: DSL -> theme -> accentColor. */
  readonly color: string;
  /** Glow/beam opacity [0-1]. Default: 0.5 for glow, 0.35 for holographic. */
  readonly intensity: number;
  /** Beam height in world units (holographic only). Default: 2.0. */
  readonly beamHeight?: number;
  /** Enable smoke particles (holographic only). Default: false. */
  readonly smoke?: boolean;
  /** Enable volumetric dust motes in the beam (holographic only). Default: false. */
  readonly dust?: boolean;
  /** Z offset in world units. Negative = push back (away from camera). Default: 0. */
  readonly zOffset?: number;
  /** Backdrop opacity [0-1]. 0 = no backdrop. Default: 0.2. */
  readonly backdropOpacity?: number;
  /** Backdrop color. Auto-resolved from blendMode when not set. */
  readonly backdropColor?: string;
  /** Blending mode. 'additive' for dark scenes, 'normal' for light scenes. */
  readonly blendMode: 'additive' | 'normal';
  /** When true, this highlight follows a specific view (resolved at render time). */
  readonly followView?: boolean;
};

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
  /** Named material preset from the MaterialManifest. */
  surfaceMaterial: string | null;
  /** Application controls for the material preset. */
  materialApplication: MaterialApplication;
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
  /** Extra border around the tray edge beyond the view extent, in NVS units. Default: 0. */
  outerMargin: number;
  /** Carousel zStep -- used to compute ring center Z position and tray Z depth for ring carousels. */
  zStep: number;
  /** Carousel spread -- used to compute ring X radius for disc sizing (legacy compat). */
  spread: number;
  /** Per-view highlight effects. Empty array = no highlights. */
  readonly viewHighlights: readonly ViewHighlight[];
};
