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
 * Unified scene theme token set.
 *
 * Defined in @brewsite/core; imported and consumed by all packages.
 * Always optional — existing scenes that never pass a SceneTheme behave
 * identically to today.
 *
 * Injection points:
 * - Player level: `<EngineProvider sceneTheme={theme}>` → CSS variables via ThemeContext
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
  readonly font: SceneThemeFontTokens;
  /** Semantic font size scale. Use 1.0 for the identity scale (no change). */
  readonly fontSize: SceneThemeFontSizeScale;
  /** Optional background fill and effects configuration. */
  readonly background?: SceneThemeBackground;
  /**
   * Primary accent color. Drives diagram node palette defaults and chart series[0].
   * Each package may interpret this differently. CSS hex string.
   * @example '#6b48ff'
   */
  readonly accentColor?: string;
};
