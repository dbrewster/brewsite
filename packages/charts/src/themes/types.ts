// Chart theme type contracts — no Three.js, no React.

/** Supported chart theme preset names. */
export type ChartThemeName = 'darkGlass' | 'neonCyber' | 'enterprise' | 'lightMinimal';

/** Material tokens for a single data series. */
export type ChartSeriesMaterialTokens = {
  /** Base color as CSS hex string (e.g. '#00d4ff'). */
  readonly color: string;
  /** Metalness 0–1. */
  readonly metalness: number;
  /** Roughness 0–1. */
  readonly roughness: number;
  /** Glass transmission 0–1. 0 = opaque, 1 = fully transparent. */
  readonly transmission: number;
  /** Emissive intensity multiplier. */
  readonly emissiveIntensity: number;
  /** Depth for extruded geometry (bar/area). */
  readonly depth: number;
};

/** Axis line, tick, and label styling tokens. */
export type ChartAxisTokens = {
  /** Axis line color. */
  readonly lineColor: string;
  /** Tick label text color. */
  readonly labelColor: string;
  /** Font size for tick labels (world units). */
  readonly fontSize: number;
  /** Tick line length (world units). */
  readonly tickLength: number;
};

/** Chart background and floor plane tokens. */
export type ChartBackgroundTokens = {
  /** Background plane color (null = no background plane). */
  readonly planeColor: string | null;
  /** Background plane opacity. */
  readonly planeOpacity: number;
  /** Floor grid line color (null = no grid). */
  readonly gridColor: string | null;
};

/**
 * Complete chart theme — material tokens for up to 8 series, axis styling,
 * and background/floor styling.
 */
export type ChartTheme = {
  readonly name: ChartThemeName;
  /** Ordered series material tokens. Index wraps modulo series count. */
  readonly series: readonly ChartSeriesMaterialTokens[];
  readonly axis: ChartAxisTokens;
  readonly background: ChartBackgroundTokens;
};
