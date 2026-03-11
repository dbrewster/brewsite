import { darkGlassChartTheme } from './darkGlass';
import { neonCyberChartTheme } from './neonCyber';
import { enterpriseChartTheme } from './enterprise';
import { lightMinimalChartTheme } from './lightMinimal';
import type {
  ChartTheme,
  ChartThemeName,
  ChartSeriesMaterialTokens,
  ChartAxisTokens,
  ChartBackgroundTokens,
  ChartLegendTokens,
  ChartLineTokens,
  ChartPieTokens,
  ChartInteractionTokens,
} from './types';

const PRESET_MAP: Record<ChartThemeName, ChartTheme> = {
  darkGlass: darkGlassChartTheme,
  neonCyber: neonCyberChartTheme,
  enterprise: enterpriseChartTheme,
  lightMinimal: lightMinimalChartTheme,
};

/** Deep-partial type for ChartTheme overrides. */
export type ChartThemeOverrides = {
  readonly name?: string;
  readonly series?: ReadonlyArray<Partial<ChartSeriesMaterialTokens>>;
  readonly axis?: Partial<ChartAxisTokens>;
  readonly background?: Partial<ChartBackgroundTokens>;
  readonly legend?: Partial<ChartLegendTokens>;
  readonly line?: Partial<ChartLineTokens>;
  readonly pie?: Partial<ChartPieTokens>;
  readonly interaction?: Partial<ChartInteractionTokens>;
};

/**
 * Creates a ChartTheme by merging overrides on top of a base preset.
 *
 * The base can be a preset name ('darkGlass', 'enterprise', etc.) or a full
 * ChartTheme object. Only the fields you override are changed — the rest
 * inherit from the base.
 *
 * @example
 * const brandTheme = createChartTheme('darkGlass', {
 *   name: 'brand',
 *   axis: { lineColor: '#ff4400', labelColor: '#ffffff' },
 *   series: [
 *     { color: '#ff4400', metalness: 0.3, roughness: 0.4, transmission: 0, emissiveIntensity: 0.1, depth: 0.3 },
 *   ],
 * });
 *
 * // Use in DSL:
 * <Chart id="c1" type="bar" theme={brandTheme}>
 *   <ChartData source="sales" />
 * </Chart>
 */
export function createChartTheme(
  base: ChartThemeName | ChartTheme,
  overrides: ChartThemeOverrides = {},
): ChartTheme {
  const baseTheme: ChartTheme =
    typeof base === 'string' ? PRESET_MAP[base] : base;

  const mergedSeries: readonly ChartSeriesMaterialTokens[] = overrides.series
    ? overrides.series.map((s, i) => ({
        ...baseTheme.series[i % baseTheme.series.length]!,
        ...s,
      }))
    : baseTheme.series;

  return {
    name: overrides.name ?? baseTheme.name,
    series: mergedSeries,
    axis: overrides.axis ? { ...baseTheme.axis, ...overrides.axis } : baseTheme.axis,
    background: overrides.background
      ? { ...baseTheme.background, ...overrides.background }
      : baseTheme.background,
    legend: overrides.legend
      ? { ...baseTheme.legend, ...overrides.legend }
      : baseTheme.legend,
    line: overrides.line
      ? { ...baseTheme.line, ...overrides.line }
      : baseTheme.line,
    pie: overrides.pie
      ? { ...baseTheme.pie, ...overrides.pie }
      : baseTheme.pie,
    interaction: overrides.interaction
      ? { ...baseTheme.interaction, ...overrides.interaction }
      : baseTheme.interaction,
  };
}
