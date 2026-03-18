// Chart DSL stub component prop types — never rendered, only compiled by NodeHandlers.
import React from 'react';
import type {
  ChartDataDSL,
  ChartAxisDSL,
  ChartSeriesDSL,
  ChartLegendDSL,
  ChartDataLabelsDSL,
  ReferenceLineDSL,
  ChartLineShape,
} from './types';
import type { DataInput } from '../../data/types';

// Suppress unused import warning — React is required for JSX context in .tsx files
void React;

// ─── V2 Shared Base Props ─────────────────────────────────────────────────────

/**
 * Shared props for all per-type chart DSL components.
 * Per-type DSL types extend this with type-specific options.
 */
export type BaseChartDSL = {
  readonly id: string;
  /** Inline data rows or columnar data object. Mutually exclusive with dataUrl. */
  readonly data?: DataInput;
  /** URL for async JSON/CSV fetch. Mutually exclusive with data. */
  readonly dataUrl?: string;
  readonly opacity?: number;
  readonly interactive?: boolean;
  readonly x?: number;
  readonly y?: number;
  readonly w?: number;
  readonly h?: number;
  readonly z?: number;
  readonly rotation?: readonly [number, number, number];
  /**
   * 3D extrusion depth of chart geometry in world units.
   * Only the depth dimension is meaningful — width/height are always derived from w/h.
   * @default 0.4
   */
  readonly depth?: number;
  /** Per-chart gridlines override. */
  readonly gridlines?: boolean;
  /**
   * V2.1: Enable bar-grow entry animation driven by blockProgress. Scoped to BarRenderer in V2.1.
   * @default false
   */
  readonly animateEntry?: boolean;
  /**
   * V2.1: Duration of entry animation as a fraction of blockProgress [0..1].
   * Animation completes when blockProgress reaches this value.
   * @default 0.4
   */
  readonly animationDuration?: number;
  readonly children?: React.ReactNode;
};

// ─── V2 Per-Type DSL Types ────────────────────────────────────────────────────

/** DSL props for <BarChart>. */
export type BarChartDSL = BaseChartDSL & {
  readonly orientation?: 'vertical' | 'horizontal';
  readonly stackMode?: 'grouped' | 'stacked';
  readonly barPadding?: number;
};

/** DSL props for <LineChart>. */
export type LineChartDSL = BaseChartDSL & {
  readonly lineShape?: ChartLineShape;
  readonly lineSmoothness?: number;
  readonly lineSubdivisions?: number;
  readonly showPoints?: boolean;
};

/** DSL props for <ScatterPlotChart>. */
export type ScatterPlotChartDSL = BaseChartDSL & {
  readonly sizeField?: string;
  readonly colorField?: string;
  readonly pointShape?: 'sphere' | 'cube' | 'cylinder';
  readonly sizeScale?: { readonly min: number; readonly max: number };
  readonly colorInterpolator?: 'blues' | 'reds' | 'viridis' | 'plasma';
};

/** DSL props for <PieChart>. */
export type PieChartDSL = BaseChartDSL & {
  readonly innerRadius?: number;
  readonly pieTilt?: number;
  readonly explodeSlice?: string;
};

/** DSL props for <AreaChart>. */
export type AreaChartDSL = BaseChartDSL & {
  readonly stackMode?: 'none' | 'stacked';
  readonly fillOpacity?: number;
};

/** DSL props for <HeatMapChart>. */
export type HeatMapChartDSL = BaseChartDSL & {
  readonly timeField?: string;
  readonly heightField?: string;
  readonly colorInterpolator?: 'blues' | 'reds' | 'viridis' | 'plasma';
};

// ─── V2 Per-Type Prop Types (aliases for stub functions) ─────────────────────

export type BarChartProps = BarChartDSL;
export type LineChartProps = LineChartDSL;
export type ScatterPlotChartProps = ScatterPlotChartDSL;
export type PieChartProps = PieChartDSL;
export type AreaChartProps = AreaChartDSL;
export type HeatMapChartProps = HeatMapChartDSL;

// ─── V2 Shared Child Component Prop Types ────────────────────────────────────

export type ChartDataProps = ChartDataDSL;
export type ChartAxisProps = ChartAxisDSL;
export type ChartSeriesProps = ChartSeriesDSL;
export type ChartLegendProps = ChartLegendDSL;
export type ChartDataLabelsProps = ChartDataLabelsDSL;
export type ReferenceLineProps = ReferenceLineDSL;

// ─── Tooltip DSL prop type ────────────────────────────────────────────────────

/** Props for the <ChartTooltip> DSL child component. */
export type ChartTooltipProps = {
  /** Enable Y-axis projection beam. Default: false. */
  readonly projection?: boolean;
  /** d3-format string for Y values. Default: '.3~s'. */
  readonly format?: string;
};

