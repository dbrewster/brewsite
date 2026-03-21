// Single source of truth for SceneTheme token types.
// Imported by all packages that participate in cross-package theming.

/**
 * Background polarity for the scene. Follows CSS prefers-color-scheme naming convention.
 * 'dark'  = dark-background scene (drives light text/surface defaults downstream).
 * 'light' = light-background scene (drives dark text/surface defaults downstream).
 *
 * This token drives DEFAULTS only. Explicit color values in DiagramTheme/ChartTheme
 * take precedence over colorMode-derived defaults.
 */
export type SceneColorMode = 'dark' | 'light';

/**
 * Font family tokens for HTML and WebGL rendering targets.
 * These are separate tokens because HTML CSS and troika-three-text use incompatible
 * font formats — a CSS font-family string cannot be used as a troika fontUrl.
 */
export type SceneThemeFontTokens = {
  /**
   * CSS font-family string for HTML overlay content rendered inside EngineOverlayHost.
   * Injected as --brewsite-font-family CSS custom property and as fontFamily inline style
   * for CSS cascade to labels and overlay children.
   * @example 'Inter, system-ui, sans-serif'
   */
  readonly htmlFamily: string;
  /**
   * URL to an MSDF-encoded .ttf or .woff font file for Three.js text via troika-three-text.
   * Applies to: diagram node labels, group title labels, chart axis tick labels,
   * chart axis title labels, chart legend labels.
   *
   * If absent, each package falls back to the troika built-in default font.
   * IMPORTANT: The file must be MSDF-encoded. A standard web font URL will not render
   * correctly. For production, self-host the font file.
   *
   * @example 'https://my-cdn.com/fonts/inter-msdf.ttf'
   */
  readonly webglFontUrl?: string;
};

/**
 * Semantic font size scale — multipliers applied relative to each package's
 * internal base size.
 *
 * For HTML overlays: multiply against 1rem (browser default, 16px).
 *   --brewsite-font-size-heading = calc(1rem * heading)
 *
 * For WebGL text (troika): multiply against each package's internal world-unit base.
 *   Diagram: node height × 0.28 × label, group title × labelSizeFactor × label
 *   Charts: ChartAxisTokens.fontSize × annotation, ChartLegendTokens.fontSize × label
 *
 * These are proportional relationships, not absolute equivalences across rendering
 * targets. A scale of 0.8 makes text proportionally smaller in both HTML and WebGL,
 * but the rendered pixel sizes will differ because HTML px and Three.js world units
 * have no shared coordinate system.
 */
export type SceneThemeFontSizeScale = {
  /** e.g. 1.5 — large titles and section headings */
  readonly heading: number;
  /** e.g. 1.0 — standard reading text; the reference scale */
  readonly body: number;
  /** e.g. 0.85 — node labels, axis labels, legend text */
  readonly label: number;
  /** e.g. 0.7 — sublabels, small explanatory text */
  readonly caption: number;
  /** e.g. 0.6 — tiny callouts, axis tick labels */
  readonly annotation: number;
};

/**
 * Background fill — what the background IS. Mutually exclusive kinds.
 * 'color'    — solid CSS color string
 * 'image'    — image URL with optional CSS background-size and background-position
 * 'gradient' — CSS gradient string (e.g. 'linear-gradient(180deg, #0a0a14, #1a1a3e)')
 */
export type SceneThemeBackgroundFill =
  | { readonly kind: 'color'; readonly value: string }
  | { readonly kind: 'image'; readonly url: string; readonly size?: string; readonly position?: string }
  | { readonly kind: 'gradient'; readonly value: string };

/**
 * CSS filter and overlay effects applied on top of the background fill layer.
 * These are separate from the fill so an author can blur an image background
 * independently of changing the image itself.
 *
 * CSS filter is applied to the background element (may blur edge artifacts).
 * Overlay gradient and backdrop-filter apply to a second DOM element above the
 * background element, below the scene content.
 */
export type SceneThemeBackgroundEffects = {
  /**
   * CSS filter applied to the background DOM element.
   * @example 'blur(4px) brightness(0.8)'
   */
  readonly cssFilter?: string;
  /**
   * CSS gradient string for an overlay layer above the background, below scene content.
   * Requires BackgroundWidget to manage a second overlay DOM element.
   * @example 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 50%)'
   */
  readonly overlayGradient?: string;
  /**
   * CSS backdrop-filter applied to the overlay layer.
   * BROWSER SUPPORT: Not universally supported on older Android WebViews.
   * Use @supports guards or document the limitation for your target audience.
   * @example 'blur(12px)'
   */
  readonly backdropFilter?: string;
  /** Overall background opacity [0–1]. Applied to the background element. Default: 1 */
  readonly opacity?: number;
};

/**
 * Background configuration bundled into SceneTheme.
 * Defines the visual appearance of the scene background when used via
 * `<Background theme={sceneTheme} />`.
 */
export type SceneThemeBackground = {
  /** The background fill (color, image, or gradient). */
  readonly fill?: SceneThemeBackgroundFill;
  /** CSS filter and overlay effects layered on top of the fill. */
  readonly effects?: SceneThemeBackgroundEffects;
};

/**
 * Theme tokens for the default floor grid surface.
 *
 * Applies to `<Floor variant="grid" />` and any floor surface using
 * `pattern="grid"` when the Floor DSL node receives a `theme`.
 */
export type SceneThemeFloorGrid = {
  /**
   * Minor grid spacing in world units.
   * Maps to FloorPhysicalProps.gridCellSize.
   */
  readonly spacing?: number;
  /**
   * Minor line color.
   * Maps to FloorPhysicalProps.gridColor.
   */
  readonly lineColor?: string;
  /**
   * Major line color.
   * Maps to FloorPhysicalProps.gridMajorColor.
   */
  readonly majorLineColor?: string;
  /**
   * Base fill color under grid lines.
   * Maps to FloorPhysicalProps.color.
   */
  readonly fillColor?: string;
  /**
   * Line opacity [0-1].
   * Maps to FloorPhysicalProps.gridLineOpacity.
   */
  readonly lineOpacity?: number;
  /**
   * Fill opacity [0-1].
   * Maps to FloorPhysicalProps.gridFillOpacity.
   */
  readonly fillOpacity?: number;
  /**
   * Number of minor cells per major grid line.
   * Maps to FloorPhysicalProps.gridMajorEvery.
   */
  readonly majorEvery?: number;
};

/**
 * Theme tokens for floor rendering.
 */
export type SceneThemeFloor = {
  /** Grid-floor visual tokens. */
  readonly grid?: SceneThemeFloorGrid;
  /**
   * Optional world-space reach in the negative Z direction from floor origin.
   * Maps to FloorProps.negativeZExtent.
   */
  readonly negativeZExtent?: number;
  /**
   * Back-edge behavior for negative-Z depth control.
   * Maps to FloorProps.negativeZEdge.
   */
  readonly negativeZEdge?: 'hard' | 'fade';
  /**
   * Fade distance in world units when `negativeZEdge='fade'`.
   * Maps to FloorProps.negativeZFadeDistance.
   */
  readonly negativeZFadeDistance?: number;
  /** Named material preset. When set, PBR textures from the manifest are applied. */
  readonly surfaceMaterial?: string;
  /** Application controls for the material preset. */
  readonly materialApplication?: import('../widget/materialTypes').MaterialApplication;
};

/**
 * Theme tokens for the carousel tray rendered beneath ViewLayout carousels.
 *
 * All fields are optional. When a DSL prop is set on <CarouselTray>, it
 * takes precedence over the theme value. When neither is set, the compiled
 * default applies.
 */
export type SceneThemeCarouselTray = {
  /** Tray base color. */
  readonly color?: string;
  /** Tray base opacity [0-1]. */
  readonly opacity?: number;
  /** Accent/highlight color. */
  readonly accentColor?: string;
  /** Depth (thickness) of the tray in world units. */
  readonly depth?: number;
  /** Gap between tray bottom and floor top in world units. */
  readonly gap?: number;
  /** Material metalness [0-1]. */
  readonly metalness?: number;
  /** Material roughness [0-1]. */
  readonly roughness?: number;
  /** Front-edge surface treatment style. */
  readonly edgeStyle?: 'smooth' | 'knurled' | 'ridged' | 'matte';
  /** Surface texture pattern. */
  readonly surfacePattern?: 'brushed' | 'radial' | 'crosshatch' | 'grain' | 'none';
  /** Surface texture intensity [0-1]. */
  readonly surfaceIntensity?: number;
  /** URL to a custom normal map texture. Overrides surfacePattern when set. */
  readonly surfaceMapUrl?: string;
  /** Named material preset from the MaterialManifest. */
  readonly surfaceMaterial?: string;
  /** Application controls for the material preset. */
  readonly materialApplication?: import('../widget/materialTypes').MaterialApplication;
  /** Extra border around the tray edge beyond the view extent. Accepts SceneLength. */
  readonly outerMargin?: import('../units/types').SceneLength;
  /**
   * Default highlight mode for the active carousel item.
   * @deprecated Use `<Highlight>` as a sibling child of `<ViewLayout>` instead. Will be removed in the next major version.
   */
  readonly highlightActive?: import('../elements/carousel-scrubber/types').ViewHighlightMode;
  /**
   * Default highlight color. Falls back to accentColor.
   * @deprecated Use `<Highlight>` as a sibling child of `<ViewLayout>` instead. Will be removed in the next major version.
   */
  readonly highlightColor?: string;
  /**
   * Default highlight intensity [0-1].
   * @deprecated Use `<Highlight>` as a sibling child of `<ViewLayout>` instead. Will be removed in the next major version.
   */
  readonly highlightIntensity?: number;
  /**
   * Default beam height for holographic mode [world units].
   * @deprecated Use `<Highlight>` as a sibling child of `<ViewLayout>` instead. Will be removed in the next major version.
   */
  readonly highlightBeamHeight?: number;
  /**
   * Enable smoke ring for holographic highlights.
   * @deprecated Use `<Highlight>` as a sibling child of `<ViewLayout>` instead. Will be removed in the next major version.
   */
  readonly highlightSmoke?: boolean;
  /**
   * Z offset for highlights in world units. Negative = push back.
   * @deprecated Use `<Highlight>` as a sibling child of `<ViewLayout>` instead. Will be removed in the next major version.
   */
  readonly highlightZOffset?: number;
  /**
   * Default highlight backdrop color.
   * Auto-resolved from polarity when not set (dark=#000000, light=#e8e4e0).
   * @deprecated Use `<Highlight>` as a sibling child of `<ViewLayout>` instead. Will be removed in the next major version.
   */
  readonly highlightBackdropColor?: string;
  /**
   * Target a specific view by ID instead of the active item.
   * @deprecated Use `<Highlight>` as a sibling child of `<ViewLayout>` instead. Will be removed in the next major version.
   */
  readonly highlightViewId?: string;
};

/**
 * Semantic highlight variant name.
 * Used to reference a pre-defined highlight style from the theme palette.
 */
export type HighlightVariantName =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'error'
  | 'warning'
  | 'success'
  | 'info';

/**
 * A single highlight variant definition — all visual parameters for
 * a named highlight variant. Resolved from SceneTheme.highlightPalette
 * at compile time.
 *
 * Any field not set falls through to the highlight's explicit prop,
 * then to the carousel tray's default.
 */
export type SceneThemeHighlightVariant = {
  /** Highlight color. */
  readonly color: string;
  /** Highlight mode. Default: 'holographic'. */
  readonly mode?: import('../elements/carousel-scrubber/types').ViewHighlightMode;
  /** Intensity [0-1]. */
  readonly intensity?: number;
  /** Blending mode. Auto-resolved from polarity when not set. */
  readonly blendMode?: 'additive' | 'normal';
  /** Backdrop opacity [0-1]. 0 = no backdrop. */
  readonly backdropOpacity?: number;
  /**
   * Backdrop color. Tints the semi-transparent backdrop cylinder behind the beam.
   * Auto-resolved from polarity when not set:
   * - dark scenes default to '#000000' (black dim)
   * - light scenes default to '#e8e4e0' (smokey warm white)
   */
  readonly backdropColor?: string;
  /** Beam height in world units. */
  readonly beamHeight?: number;
  /** Enable smoke particles. */
  readonly smoke?: boolean;
  /** Enable volumetric dust motes. */
  readonly dust?: boolean;
};

/**
 * Highlight palette — named variants of highlight styles.
 * Defined per-theme, tuned for the theme's polarity and color scheme.
 *
 * Usage in DSL:
 * ```tsx
 * highlights={[{ viewId: 'chart-1', series: 'error' }]}
 * ```
 *
 * The compile step resolves the series name to concrete visual params
 * from this palette.
 */
export type SceneThemeHighlightPalette = {
  readonly [K in HighlightVariantName]?: SceneThemeHighlightVariant;
};

/**
 * Default highlight configuration when no variant is specified.
 * Lives at the `SceneTheme` level alongside `highlightPalette`.
 */
export type SceneThemeHighlightDefaults = {
  /** Default mode when no variant or explicit mode is set. Default: 'glow'. */
  readonly mode?: import('../elements/carousel-scrubber/types').ViewHighlightMode;
  /** Default backdrop opacity [0-1]. */
  readonly backdropOpacity?: number;
  /** Default backdrop color. Auto-resolved from polarity when not set. */
  readonly backdropColor?: string;
  /** Default beam height [world units]. */
  readonly beamHeight?: number;
};

/**
 * Unified scene theme token set.
 *
 * Defined in @brewsite/core; imported and consumed by all packages.
 * Always optional — existing scenes that never pass a SceneTheme behave
 * identically to today.
 *
 * Injection points:
 * - Player level: `<SceneEngine theme={theme}>` → CSS variables via ThemeContext
 * - Per-scene background: `<Background theme={theme} />` → DOM fill and effects
 * - Per-diagram: `DiagramTheme.sceneTheme` → font URL and label color polarity fallbacks
 * - Per-chart: `ChartTheme.sceneTheme` or `ChartDSL.sceneTheme` → font URL and color defaults
 */
export type SceneTheme = {
  /**
   * Background polarity. 'dark' = dark scene (drives light text defaults).
   * 'light' = light scene (drives dark text defaults).
   */
  readonly colorMode: SceneColorMode;
  /** Font tokens for HTML and WebGL rendering. */
  readonly font: SceneThemeFontTokens & {
    /**
     * Optional CSS font-family string for headings. EngineOverlayHost injects
     * --brewsite-font-heading. Falls back to font.htmlFamily when absent.
     */
    readonly htmlHeadingFamily?: string;
  };
  /** Semantic font size scale. Use 1.0 for the identity scale (no change). */
  readonly fontSize: SceneThemeFontSizeScale;
  /** Optional background fill and effects configuration. */
  readonly background?: SceneThemeBackground;
  /** Optional floor configuration. */
  readonly floor?: SceneThemeFloor;
  /** Optional carousel tray visual tokens. */
  readonly carouselTray?: SceneThemeCarouselTray;
  /** Semantic highlight palette — named highlight variants. */
  readonly highlightPalette?: SceneThemeHighlightPalette;
  /** Default highlight configuration when no variant is specified. */
  readonly highlightDefaults?: SceneThemeHighlightDefaults;

  /** Primary brand/accent color. Default: '#2563eb' (blue-600). */
  readonly accentColor?: string;

  /**
   * Per-family text and surface color overrides. When present, take precedence
   * over colorMode-derived defaults in EngineOverlayHost. When absent,
   * EngineOverlayHost falls back to existing derivation rules.
   */
  readonly textColors?: {
    /** Overrides --brewsite-text-primary */
    readonly primary?: string;
    /** Overrides --brewsite-text-secondary */
    readonly secondary?: string;
    /** Overrides --brewsite-text-muted (new variable) */
    readonly muted?: string;
    /** Overrides --brewsite-surface-elevated */
    readonly surface?: string;
  };

  /** Semantic status colors. Falls back to highlightPalette colors or hardcoded defaults. */
  readonly semanticColors?: {
    readonly success?: string;   // default: '#22c55e'
    readonly warning?: string;   // default: '#f59e0b'
    readonly error?: string;     // default: '#ef4444'
    readonly info?: string;      // default: '#3b82f6'
  };

  /** Spacing scale for HTML overlay content. Values are CSS length strings. */
  readonly spacing?: {
    readonly xs?: string;   // default: '4px'
    readonly sm?: string;   // default: '8px'
    readonly md?: string;   // default: '16px'
    readonly lg?: string;   // default: '24px'
    readonly xl?: string;   // default: '40px'
  };
};

/**
 * Canonical theme family names. All names have matching presets in
 * @brewsite/diagram (DiagramThemeName) and @brewsite/charts (ChartThemeName).
 * This type is the single source of truth for the cross-package theme name vocabulary.
 *
 * 'default' maps to the enterprise aesthetic and is always pre-registered in
 * sceneThemeRegistry — no explicit registration required.
 */
export type ThemeFamily =
  | 'default'
  | 'enterprise'
  | 'darkGlass'
  | 'midnight'
  | 'neonCyber'
  | 'lightCanvas'
  | 'lightMinimal';

/** Light or dark background polarity for a theme variant. */
export type ThemePolarity = 'dark' | 'light';

/**
 * The active theme selection for a SceneEngine instance.
 * Passed via `<SceneEngine theme={...}>` to select a theme family and polarity.
 * Replaces the older `themeFamily` / `themePolarity` props.
 */
export interface ActiveTheme {
  readonly family: ThemeFamily;
  readonly polarity: ThemePolarity;
}
