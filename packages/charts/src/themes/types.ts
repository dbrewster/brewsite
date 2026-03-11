// Chart theme type contracts — no Three.js, no React.

import type { SceneTheme } from '@brewsite/core';
import type { ChartLineShape } from '../elements/chart/types';

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
};
