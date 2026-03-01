// Chart DSL stub components — never rendered, only compiled by NodeHandlers.

import type { ChartDSL, ChartDataDSL, ChartAxisDSL, ChartSeriesDSL, ChartLegendDSL } from './types';

export type ChartProps = ChartDSL & { children?: React.ReactNode };
export type ChartDataProps = ChartDataDSL;
export type ChartAxisProps = ChartAxisDSL;
export type ChartSeriesProps = ChartSeriesDSL;
export type ChartLegendProps = ChartLegendDSL;

import React from 'react';

/**
 * Declares a 3D chart element.
 * Compiled by chartPlugin().configureRegistry() — never rendered to DOM.
 */
export function Chart(_props: ChartProps): null { return null; }
Chart.displayName = 'Chart';

/**
 * Declares the data source for a <Chart>.
 * Must be a direct child of <Chart>.
 */
export function ChartData(_props: ChartDataProps): null { return null; }
ChartData.displayName = 'ChartData';

/**
 * Declares one axis configuration for a <Chart>.
 * Must be a direct child of <Chart>.
 */
export function ChartAxis(_props: ChartAxisProps): null { return null; }
ChartAxis.displayName = 'ChartAxis';

/**
 * Declares one data series for a <Chart>.
 * Must be a direct child of <Chart>.
 * Multiple <ChartSeries> children yield a multi-series chart.
 */
export function ChartSeries(_props: ChartSeriesProps): null { return null; }
ChartSeries.displayName = 'ChartSeries';

/**
 * Configures the chart legend.
 * Must be a direct child of <Chart>.
 */
export function ChartLegend(_props: ChartLegendProps): null { return null; }
ChartLegend.displayName = 'ChartLegend';
