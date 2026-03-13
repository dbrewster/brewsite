// Module-level ChartTooltipStore — bridges ChartWidget hover events to ChartTooltipHost.

import { useSyncExternalStore } from 'react';
import type { ChartHitInfo } from '../../../renderers/shared/IChartRenderer';
import type { ChartTooltipTokens } from '../../../themes/types';
import type { ChartTooltipRuntimeConfig } from './types';

/** State written to the store on each hover event. */
export type ChartTooltipEntry = {
  /** Widget ID (= chart's `id` prop). */
  readonly widgetId: string;
  /** Projected pixel X within the EngineOverlayHost container. */
  readonly x: number;
  /** Projected pixel Y within the EngineOverlayHost container. */
  readonly y: number;
  /** Raw hover info from the raycaster. */
  readonly info: ChartHitInfo;
  /**
   * Resolved tooltip theme tokens from the active chart theme.
   * Null when the widget has not yet resolved a theme.
   */
  readonly tooltipTokens: ChartTooltipTokens | null;
  /**
   * d3-format string from ChartState.tooltip.format.
   * Passed through so ChartTooltipHost can format values without accessing ChartState.
   * Absent when no format was specified in the DSL.
   */
  readonly format?: string;
};

type Subscriber = () => void;

/** Store class — exported for test instantiation. Do not use directly in production; use the singleton. */
export class ChartTooltipStoreImpl {
  private state: ChartTooltipEntry | null = null;
  private readonly subscribers = new Set<Subscriber>();
  private readonly runtimeConfigs = new Map<string, ChartTooltipRuntimeConfig>();
  /** @internal */ hostCount = 0;
  private readonly warnedIds = new Set<string>();

  // ── useSyncExternalStore API ────────────────────────────────────────────

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: Subscriber): () => void {
    this.subscribers.add(listener);
    return () => { this.subscribers.delete(listener); };
  }

  /** Returns the current tooltip entry, or null when no chart is hovered. */
  getSnapshot(): ChartTooltipEntry | null {
    return this.state;
  }

  // ── Write API (called by ChartWidget) ───────────────────────────────────

  /**
   * Publishes a new tooltip entry for the given chart widget.
   * Fires a dev-mode warning (deferred by one microtask) if no host is mounted.
   */
  publish(
    widgetId: string,
    x: number,
    y: number,
    info: ChartHitInfo,
    tooltipTokens: ChartTooltipTokens | null,
    format?: string,
  ): void {
    this.state = { widgetId, x, y, info, tooltipTokens, format };
    this.notify();

    if (process.env['NODE_ENV'] !== 'production' && !this.warnedIds.has(widgetId)) {
      // Defer warning by one microtask to give host a chance to register
      Promise.resolve().then(() => {
        if (this.hostCount === 0) {
          this.warnedIds.add(widgetId);
          console.warn(
            `[ChartTooltipStore] Chart "${widgetId}" has tooltip enabled but no ` +
            `<ChartTooltipHost /> is mounted. Add <ChartTooltipHost /> inside EngineOverlayHost.`,
          );
        }
      });
    }
  }

  /** Clears the active entry if it belongs to widgetId. No-op if a different chart is active. */
  clear(widgetId: string): void {
    if (this.state?.widgetId === widgetId) {
      this.state = null;
      this.notify();
    }
  }

  // ── Runtime config API (called by useChartTooltipConfig) ───────────────

  /** Registers (or updates) runtime tooltip config for chartId. */
  setRuntimeConfig(chartId: string, config: ChartTooltipRuntimeConfig): void {
    this.runtimeConfigs.set(chartId, config);
  }

  /** Deregisters runtime tooltip config for chartId. */
  clearRuntimeConfig(chartId: string): void {
    this.runtimeConfigs.delete(chartId);
  }

  /** Returns the runtime config for chartId, or undefined if not registered. */
  getRuntimeConfig(chartId: string): ChartTooltipRuntimeConfig | undefined {
    return this.runtimeConfigs.get(chartId);
  }

  // ── Host tracking API (called by ChartTooltipHost) ──────────────────────

  /** Register a mounted ChartTooltipHost. Returns a cleanup function. */
  registerHost(): () => void {
    this.hostCount++;
    return () => { this.hostCount--; };
  }

  private notify(): void {
    for (const sub of this.subscribers) sub();
  }
}

// DEBT: Add injection seam for testing — ChartWidget should accept store via constructor
/** Module-level singleton store. Shared across all chart widgets in the engine. */
export const chartTooltipStore = new ChartTooltipStoreImpl();

/**
 * React hook for reading ChartTooltipStore state.
 * Uses useSyncExternalStore for React 18+ concurrent-safe subscriptions.
 * Subscribes to the module-level singleton.
 */
export function useChartTooltip(): ChartTooltipEntry | null {
  return useSyncExternalStore(
    chartTooltipStore.subscribe.bind(chartTooltipStore),
    chartTooltipStore.getSnapshot.bind(chartTooltipStore),
  );
}
