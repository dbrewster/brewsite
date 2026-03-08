// Chart DSL stub components — never rendered, only compiled by NodeHandlers.

import type { ChartDSL, ChartDataDSL, ChartAxisDSL, ChartSeriesDSL, ChartLegendDSL } from './types';

export type ChartProps = ChartDSL & { children?: React.ReactNode };
export type ChartDataProps = ChartDataDSL;
export type ChartAxisProps = ChartAxisDSL;
export type ChartSeriesProps = ChartSeriesDSL;
export type ChartLegendProps = ChartLegendDSL;

import React from 'react';
