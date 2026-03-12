// Tooltip type contracts — no Three.js, no React, no runtime imports.

import type React from 'react';
import type { ChartHitInfo } from '../../../renderers/shared/IChartRenderer';

/**
 * Compiled tooltip state. Lives in ChartState.tooltip — SceneTrack-safe.
 * No functions. Custom renderContent is registered separately via useChartTooltipConfig().
 */
export type ChartTooltipState = {
  /** Whether the Y-axis projection beam is rendered on hover. Default: false. */
  readonly projection: boolean;
  /**
   * d3-format string for numeric Y values displayed in the tooltip.
   * @default '.3~s'
   */
  readonly format?: string;
};

/**
 * Runtime-only tooltip configuration. NOT compiled into SceneTrack.
 * Registered via useChartTooltipConfig() and read by ChartWidget in apply().
 * Custom function — intentionally excluded from SceneTrack serialization.
 */
export type ChartTooltipRuntimeConfig = {
  /**
   * Custom React content for the tooltip.
   * When absent, the built-in type-aware DefaultTooltipContent is used.
   */
  readonly renderContent?: (info: ChartHitInfo) => React.ReactNode;
};
