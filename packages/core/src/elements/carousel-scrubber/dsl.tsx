// CarouselTray — DSL child component for ViewLayout carousel tray.

import type { CarouselScrubberStyle, ViewHighlightMode, ViewHighlightConfig } from './types';

/**
 * Props for the <CarouselTray> DSL component.
 *
 * Place as a child of <ViewLayout kind="carousel"> to render a 3D tray base
 * underneath the carousel. Position and size are computed automatically from
 * the carousel's layout bounds and floor position.
 *
 * All visual settings can also be set at the theme level via
 * `SceneTheme.carouselTray`. DSL props override theme values.
 */
export type CarouselTrayProps = {
  /** Tray base color. Default: '#2C3E55'. */
  color?: string;
  /** Tray base opacity [0..1]. Default: 0.6. */
  opacity?: number;
  /** Accent color for tray highlights. Default: '#5090e0'. */
  accentColor?: string;
  /** Depth (thickness) of the tray in world units. Default: 0.36. */
  depth?: number;
  /** Gap between tray bottom edge and floor in world units. Default: 0.02. */
  gap?: number;
  /**
   * Extra border around the outside of the tray beyond the view extent,
   * in NVS coordinates. Applied uniformly to all edges.
   * Default: 0 (tray hugs the views with only the built-in 5% padding).
   *
   * @example outerMargin={0.1}  // 10% of viewport width per side
   */
  outerMargin?: number;
  /** Material metalness [0-1]. Default: 0.4. */
  metalness?: number;
  /** Material roughness [0-1]. Default: 0.55. */
  roughness?: number;
  /** Front-edge surface treatment. Default: 'knurled'. */
  edgeStyle?: 'smooth' | 'knurled' | 'ridged' | 'matte';
  /** Surface texture pattern. Default: 'brushed'. */
  surfacePattern?: 'brushed' | 'radial' | 'crosshatch' | 'grain' | 'none';
  /** Surface texture intensity [0-1]. Default: 0.25. */
  surfaceIntensity?: number;
  /** URL to a custom normal map texture. Overrides surfacePattern when set. */
  surfaceMapUrl?: string;
  /** Named material preset (e.g. 'onyx', 'steel'). */
  surface?: string;
  /** How much the texture color shows [0-1]. Default: 1.0. */
  colorMix?: number;
  /** Texture brightness [0-2+]. Default: 1.0. */
  brightness?: number;
  /** Texture saturation [0-2+]. Default: 1.0. */
  saturation?: number;
  /** Texture contrast [-1 to 1]. Default: 0. */
  contrast?: number;
  /** Normal/bump depth intensity [0-1]. Default: 1.0. */
  depthMix?: number;
  /** Roughness map mix [0-1]. Default: 1.0. */
  roughnessMix?: number;
  /** Tint color multiplied into texture. */
  tint?: string;
  /** Texture scale override. */
  texScale?: number;
  /** Thin-film iridescence strength [0-1]. Default: 0. */
  iridescence?: number;
  /** Iridescence IOR [1.0-2.33]. Default: 1.3. */
  iridescenceIOR?: number;
  /** Iridescence thickness [min, max] nm. Default: [100, 400]. */
  iridescenceThicknessRange?: readonly [number, number];
  /**
   * Highlight the active (front) carousel item. Value is the highlight mode.
   * true = 'glow' (shorthand). false/'none' = disabled.
   * Theme: SceneThemeCarouselTray.highlightActive
   */
  highlightActive?: ViewHighlightMode | boolean;
  /**
   * Semantic variant name for the active highlight.
   * Resolves color, mode, intensity, etc. from the theme's highlightPalette.
   * Explicit highlight* props override variant values.
   */
  highlightVariant?: import('../../theme/types').HighlightVariantName;
  /**
   * Highlight color override. Falls back to theme -> accentColor.
   */
  highlightColor?: string;
  /**
   * Highlight intensity override [0-1].
   */
  highlightIntensity?: number;
  /**
   * Beam height for holographic mode [world units].
   */
  highlightBeamHeight?: number;
  /**
   * Enable smoke ring for holographic highlights.
   */
  highlightSmoke?: boolean;
  /**
   * Z offset for highlights in world units. Negative = push back (away from camera).
   */
  highlightZOffset?: number;
  /**
   * Target a specific view by ID instead of the active item.
   * The highlight will follow this view as it moves around the carousel.
   * Overrides highlightActive — the highlight always shows on this view.
   */
  highlightViewId?: string;
  /**
   * Explicit per-view highlight configurations.
   * Each entry targets a specific view by ID with its own mode, color, intensity.
   * Merged with highlightActive — both can be used simultaneously.
   *
   * @example
   * highlights={[
   *   { viewId: 'chart-1', mode: 'holographic', color: '#ff0000' },
   *   { viewId: 'chart-3', mode: 'glow', color: '#00ff00', intensity: 0.8 },
   * ]}
   */
  highlights?: readonly ViewHighlightConfig[];
};

/** Null-returning DSL stub. Consumed by viewLayoutHandler, not rendered directly. */
export const CarouselTray = (_props: CarouselTrayProps): null => null;
CarouselTray.displayName = 'CarouselTray';

// Keep the old type for backward compatibility with the standalone element.
export type CarouselScrubberProps = {
  id: string;
  layoutId: string;
  showBase?: boolean;
  trayDepth?: number;
  gap?: number;
  outerMargin?: number;
  style?: Partial<CarouselScrubberStyle>;
};
