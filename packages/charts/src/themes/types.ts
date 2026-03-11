// Chart theme type contracts — no Three.js, no React.

import type { SceneTheme } from '@brewsite/core';
import type { ChartLineShape } from '../elements/chart/types';

/** Supported chart theme preset names. */
export type ChartThemeName =
  | 'darkGlass'
  | 'midnight'
  | 'neonCyber'
  | 'enterprise'
  | 'lightCanvas'
  | 'lightMinimal';

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
  /** Axis line opacity multiplier. */
  readonly lineOpacity: number;
  /** Tick mark opacity multiplier. */
  readonly tickOpacity: number;
  /** Tick label text color. */
  readonly labelColor: string;
  /** Tick and title label opacity multiplier. */
  readonly labelOpacity: number;
  /** Font size for tick labels (world units). */
  readonly fontSize: number;
  /** Tick line length (world units). */
  readonly tickLength: number;
  /** Gap between the axis line and the axis label/title block (world units). */
  readonly gap: number;
  /**
   * V2.1: Font size for axis title labels, independent of tick label fontSize.
   * @default theme.axis.fontSize * 1.1 (when absent)
   */
  readonly titleFontSize?: number;
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

/** Styling tokens for the chart legend. */
export type ChartLegendTokens = {
  /** Label text color. */
  readonly textColor: string;
  /** Font size for legend labels (world units). */
  readonly fontSize: number;
  /** Side length of each color swatch (world units). */
  readonly swatchSize: number;
  /** Vertical spacing between legend entries (world units). */
  readonly spacing: number;
  /** Gap between the plot area and the legend block (world units). */
  readonly gap: number;
  /**
   * V2.1: Opacity for legend label text [0..1].
   * Separate from textColor — allows tinting while keeping the same color.
   * @default 1.0
   */
  readonly textOpacity?: number;
};

/** Styling tokens for line-chart curve generation. */
export type ChartLineTokens = {
  /** Default rendered profile shape for line charts. */
  readonly shape: ChartLineShape;
  /** Catmull-Rom tension in [0, 1]. Used for smooth lines only. */
  readonly smoothness: number;
  /** Subdivisions inserted per data-point span when building the rendered curve. */
  readonly subdivisions: number;
};

/** Styling tokens for pie/donut chart presentation. */
export type ChartPieTokens = {
  /** Default slice tilt in radians around the local X axis. */
  readonly tilt: number;
};

/** Tokens for interactive hover and selection feedback. */
export type ChartInteractionTokens = {
  /** Color applied to a hovered element (hex). */
  readonly hoverColor: string;
  /** Emissive intensity multiplier for hovered elements. */
  readonly hoverEmissiveIntensity: number;
  /** Color applied to a selected element (hex). */
  readonly selectedColor: string;
};

/**
 * V2.1: Bar chart theme defaults. Used when DSL barPadding is not specified.
 * Falls back to barPadding=0.2 when absent.
 */
export type ChartBarTokens = {
  /**
   * Padding ratio between bar groups [0..1].
   * @default 0.2
   */
  readonly padding: number;
};

/**
 * V2.1: Area chart theme defaults. Used when DSL fillOpacity is not specified.
 * Falls back to fillOpacity=0.7 when absent.
 */
export type ChartAreaTokens = {
  /**
   * Area fill opacity [0..1].
   * @default 0.7
   */
  readonly fillOpacity: number;
};

/**
 * V2.1: Gridline visual tokens.
 * When present, takes precedence over ChartBackgroundTokens.gridColor (which is deprecated).
 * When absent, ChartBackgroundTokens.gridColor is used for backward compatibility.
 */
export type ChartGridlinesTokens = {
  /** Gridline color (CSS hex). */
  readonly color: string;
  /**
   * Gridline opacity [0..1].
   * @default 0.15
   */
  readonly opacity: number;
  /**
   * Whether gridlines are visible by default for this theme.
   * Per-axis DSL gridlines prop overrides this.
   * @default false
   */
  readonly visible: boolean;
  /**
   * Dash segment length in world units. Requires LineDashedMaterial + computeLineDistances().
   * Absent = solid line (LineBasicMaterial).
   * @default undefined (solid line)
   */
  readonly dashSize?: number;
  /**
   * Gap between dash segments in world units. Only meaningful when dashSize is set.
   * @default dashSize (when dashSize is set)
   */
  readonly gapSize?: number;
};

/**
 * V2.1: Data label theme tokens. Applied when <ChartDataLabels> is present in DSL.
 */
export type ChartDataLabelsTokens = {
  /** Font size in world units. */
  readonly fontSize: number;
  /** Label text color (CSS hex). */
  readonly color: string;
  /**
   * Optional pill background color (CSS hex). Absent = no background.
   * @default undefined
   */
  readonly background?: string;
};

/**
 * V2.1: Reference line theme tokens.
 * Applied when ReferenceLine.color or lineWidth is not specified in the DSL.
 *
 * Implementation note: lineWidth is world-space width of a thin BoxGeometry plane,
 * NOT a Three.js linewidth property. BoxGeometry is more portable than LineBasicMaterial
 * for reference lines where linewidth > 1px WebGL1 cap matters. AxesRenderer (for gridlines)
 * continues to use LineBasicMaterial or LineDashedMaterial for decorative lines.
 */
export type ChartReferenceLineTokens = {
  /** Default line color (CSS hex) when not specified on <ReferenceLine>. */
  readonly defaultColor: string;
  /**
   * World-space width of the reference line BoxGeometry geometry.
   * @default 0.005
   */
  readonly lineWidth: number;
  /**
   * Line opacity [0..1].
   * @default 0.85
   */
  readonly lineOpacity: number;
};

/**
 * Complete chart theme — material tokens for up to 8 series, axis styling,
 * and background/floor styling.
 */
export type ChartTheme = {
  /** Name of this theme. String (not limited to ChartThemeName) to support custom themes. */
  readonly name: string;
  /** Ordered series material tokens. Index wraps modulo series count. */
  readonly series: readonly ChartSeriesMaterialTokens[];
  readonly axis: ChartAxisTokens;
  readonly background: ChartBackgroundTokens;
  readonly legend: ChartLegendTokens;
  readonly line: ChartLineTokens;
  readonly pie: ChartPieTokens;
  readonly interaction: ChartInteractionTokens;
  /**
   * Optional cross-package scene theme context.
   *
   * When present, ChartRenderer derives:
   * - WebGL font URL from sceneTheme.font.webglFontUrl (first-ever font customization for charts)
   * - Axis/legend label color override from sceneTheme.colorMode when not set by the chart theme
   *
   * Priority: explicit ChartTheme axis.labelColor and legend.textColor take precedence.
   * sceneTheme provides DEFAULT fallbacks only.
   *
   * Note: four built-in chart themes have explicit labelColor/textColor values.
   * sceneTheme.colorMode has no effect when using them without a custom override.
   */
  readonly sceneTheme?: SceneTheme;
  // V2.1 additions — all optional, renderers have documented fallback defaults:
  /** @default undefined (barPadding falls back to 0.2) */
  readonly bar?: ChartBarTokens;
  /** @default undefined (fillOpacity falls back to 0.7) */
  readonly area?: ChartAreaTokens;
  /** @default undefined (gridlines use background.gridColor or '#4a6080') */
  readonly gridlines?: ChartGridlinesTokens;
  /** @default undefined (DataLabelRenderer uses built-in defaults) */
  readonly dataLabels?: ChartDataLabelsTokens;
  /** @default undefined (ReferenceLineRenderer uses built-in defaults) */
  readonly referenceLines?: ChartReferenceLineTokens;
};
