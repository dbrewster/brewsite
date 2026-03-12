// ChartWidget — ISceneElement + IRenderable + IAnimationController + IDslComposite + ILoadable.

import * as THREE from 'three';
import { functionalChartTransitionSpec } from './compile';
import { ChartRenderer } from './render';
import type { ChartState, ChartStateDataSource, DataRow, ChartRenderInput } from './types';
import { DEFAULT_CHART_STATE } from './types';
import type { ChartDataStore } from '../../data/ChartDataStore';
import { normalizeDataInput, parseCsv } from '../../data/transforms';
import { validateNVSScalar } from '@brewsite/core';
import type {
  ISceneElement,
  IRenderable,
  IAnimationController,
  IDslComposite,
  ILoadable,
  INVSBounded,
  NVSCoordService,
  NVSRect,
  WidgetInitContext,
  WidgetRenderContext,
  AnimationTickContext,
  AssetManifest,
} from '@brewsite/core';
import type { ChartHitInfo, ChartAccessorFunctions } from '../../renderers/shared/IChartRenderer';
import type { ChartTheme } from '../../themes/types';
import type { ChartTooltipState } from './tooltip/types';
import { chartTooltipStore } from './tooltip/ChartTooltipStore';
import { resolveChartTheme } from '../../themes/resolveTheme';
import { darkGlassChartTheme } from '../../themes/darkGlass';
import { projectNdcToNvsPixels } from './tooltip/projectUtils';
import {
  BarChart,
  LineChart,
  ScatterPlotChart,
  PieChart,
  AreaChart,
  HeatMapChart,
  Chart,
  ChartData,
  ChartAxis,
  ChartSeries,
  ChartLegend,
  ChartDataLabels,
  ReferenceLine,
  ChartTooltip,
} from './stubs';

/** Information passed to onHover and onSelect callbacks. */
export type ChartHoverInfo = ChartHitInfo;

/**
 * Minimal interface required by ChartWidget — subset of ChartRenderer's public surface.
 * Used for the test-seam constructor parameter so ChartRendererDouble can be injected.
 * @internal
 */
type ChartRendererLike = Pick<
  ChartRenderer,
  | 'mount' | 'update' | 'dispose' | 'updateHeatmapSlice'
  | 'getInteractiveObjects' | 'resolveHoverInfo'
  | 'updateProjection' | 'tickProjection'
>;

/**
 * Widget for a single 3D chart element.
 *
 * Implements:
 * - ISceneElement<ChartState> — DSL component + transition spec
 * - IRenderable<ChartState> — Three.js lifecycle (initialize, apply, dispose)
 * - IAnimationController — heatmap time-slice animation tick + entry animation
 * - IDslComposite — routes child DSL components
 * - ILoadable — async data fetch before first tick
 * - INVSBounded — NVS region for interaction hit testing
 */
export class ChartWidget
  implements
    ISceneElement<ChartState>,
    IRenderable<ChartState>,
    IAnimationController,
    IDslComposite,
    ILoadable,
    INVSBounded
{
  readonly widgetId: string;
  readonly defaultState: ChartState = DEFAULT_CHART_STATE;
  readonly disableWhenAbsent = true;
  readonly transitionSpec = functionalChartTransitionSpec;
  readonly DslComponent = BarChart;
  readonly tickPriority = 2; // after CameraWidget(0) and DiagramWidget(1)

  // ── ILoadable ─────────────────────────────────────────────────────────────

  /** True when no async URL is configured, or after load() has completed. */
  get isLoaded(): boolean {
    return this.asyncUrl === null || this.asyncDataLoaded;
  }

  // ── IDslComposite ─────────────────────────────────────────────────────────

  readonly childDslComponents: IDslComposite['childDslComponents'] = [
    { component: LineChart        as React.ComponentType<unknown>, displayName: 'LineChart' },
    { component: ScatterPlotChart as React.ComponentType<unknown>, displayName: 'ScatterPlotChart' },
    { component: PieChart         as React.ComponentType<unknown>, displayName: 'PieChart' },
    { component: AreaChart        as React.ComponentType<unknown>, displayName: 'AreaChart' },
    { component: HeatMapChart     as React.ComponentType<unknown>, displayName: 'HeatMapChart' },
    { component: Chart            as React.ComponentType<unknown>, displayName: 'Chart' },
    { component: ChartData        as React.ComponentType<unknown>, displayName: 'ChartData' },
    { component: ChartAxis        as React.ComponentType<unknown>, displayName: 'ChartAxis' },
    { component: ChartSeries      as React.ComponentType<unknown>, displayName: 'ChartSeries' },
    { component: ChartLegend      as React.ComponentType<unknown>, displayName: 'ChartLegend' },
    { component: ChartDataLabels  as React.ComponentType<unknown>, displayName: 'ChartDataLabels' },
    { component: ReferenceLine    as React.ComponentType<unknown>, displayName: 'ReferenceLine' },
    { component: ChartTooltip     as React.ComponentType<unknown>, displayName: 'ChartTooltip' },
  ];

  // ── INVSBounded ───────────────────────────────────────────────────────────

  /**
   * Returns the NVS bounds of the chart within the AR-locked container.
   * Returns the fullscreen default { x: 0, y: 0, w: 1, h: 1 } until the first apply().
   */
  get nvsBounds(): NVSRect {
    return this.lastState?.nvsBounds ?? DEFAULT_CHART_STATE.nvsBounds;
  }

  // ── Interaction callbacks ─────────────────────────────────────────────────

  /** Called on hover interaction when interactive=true. */
  public onHover: ((info: ChartHoverInfo | null) => void) | undefined = undefined;

  /** Called on click interaction when interactive=true. */
  public onSelect: ((info: ChartHoverInfo) => void) | undefined = undefined;

  // ── Private state ─────────────────────────────────────────────────────────

  private readonly chartRenderer: ChartRendererLike;
  private readonly store: ChartDataStore;
  /** V2.1: Accessor registry passed from chartPlugin. Null when not provided. */
  private readonly accessorRegistry: Map<string, ChartAccessorFunctions> | null;
  private scene: THREE.Scene | null = null;
  private rendererDom: HTMLElement | null = null;
  private camera: THREE.Camera | null = null;
  private lastState: ChartState | null = null;
  private lastCoords: NVSCoordService | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private mousemoveListener: ((e: MouseEvent) => void) | null = null;
  private mouseleaveListener: (() => void) | null = null;
  private clickListener: ((e: MouseEvent) => void) | null = null;

  // ── ILoadable private fields ──────────────────────────────────────────────

  /** URL for async data source, set by _configureAsync(). Null = no async source. */
  private asyncUrl: string | null = null;
  /** Format for async fetch (json or csv). Default: json. */
  private asyncFormat: 'json' | 'csv' = 'json';
  /** True after load() successfully registers async data in the store. */
  private asyncDataLoaded = false;

  // ── Inline data deduplication ─────────────────────────────────────────────

  /** Reference to the last registered inline rows array — used for reference-equality guard. */
  private lastInlineRowsRef: ReadonlyArray<DataRow> | null = null;

  // ── V2.1: Entry animation ─────────────────────────────────────────────────

  /** Entry animation progress [0..1]. 1.0 = complete (default — geometry at full size). */
  private currentEntryT: number = 1.0;

  // ── Tooltip + projection state ────────────────────────────────────────────

  /** Cached resolved ChartTheme from last apply() — used by hover handlers and onTick(). */
  private lastEffectiveTheme: ChartTheme | null = null;
  /** Cached tooltip state from last apply() — controls tooltip and projection opt-in. */
  private lastTooltipState: ChartTooltipState | null = null;

  // ── V2.1: Live override cleanup ───────────────────────────────────────────

  /**
   * Unsubscribe function returned by store.onDeregisterInline().
   * Called in dispose() to prevent stale callbacks after widget is destroyed.
   */
  private readonly unsubscribeDeregister: () => void;

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @param widgetId       Widget identifier — must match the chart's `id` DSL prop.
   * @param store          The ChartDataStore owned by the chartPlugin() instance.
   * @param accessorRegistry Optional accessor registry from chartPlugin() for useChartAccessors().
   * @param rendererOverride Optional renderer override — used by tests to inject a ChartRendererDouble.
   */
  constructor(
    widgetId: string,
    store: ChartDataStore,
    accessorRegistry?: Map<string, ChartAccessorFunctions>,
    rendererOverride?: ChartRendererLike,
  ) {
    this.widgetId = widgetId;
    this.store = store;
    this.accessorRegistry = accessorRegistry ?? null;
    this.chartRenderer = rendererOverride ?? new ChartRenderer(store);

    // Register cleanup callback — store calls this when deregisterInline() fires.
    // This resets lastInlineRowsRef so the next apply() re-registers SceneTrack rows.
    this.unsubscribeDeregister = store.onDeregisterInline(widgetId, () => {
      this.lastInlineRowsRef = null;
    });
  }

  // ── Internal: called by chartPlugin.reconcileCompiledTrack when async source detected ──

  /**
   * Configures the widget for async data loading.
   * Must be called before load() — typically by chartPlugin during track reconciliation.
   */
  _configureAsync(url: string, format?: 'json' | 'csv'): void {
    this.asyncUrl = url;
    this.asyncFormat = format ?? 'json';
    this.asyncDataLoaded = false;
  }

  // ── ILoadable ─────────────────────────────────────────────────────────────

  /**
   * Fetches async data if an async URL is configured.
   * Registers the result in the store under `__async__${widgetId}`.
   * No-op if no async URL is set.
   */
  async load(_manifest: AssetManifest | null): Promise<void> {
    if (!this.asyncUrl) return;
    try {
      const resp = await fetch(this.asyncUrl);
      const rows: ReadonlyArray<Record<string, unknown>> = this.asyncFormat === 'csv'
        ? parseCsv(await resp.text())
        : (await resp.json() as ReadonlyArray<Record<string, unknown>>);
      const normalized = normalizeDataInput(rows);
      this.store.register(`__async__${this.widgetId}`, normalized);
      this.asyncDataLoaded = true;
    } catch (e) {
      console.error(`[ChartWidget] Failed to load async data from "${this.asyncUrl}":`, e);
    }
  }

  // ── IRenderable ───────────────────────────────────────────────────────────

  initialize({ scene, renderer, camera }: WidgetInitContext): void {
    this.scene = scene;
    this.chartRenderer.mount(scene);
    if (camera) {
      this.camera = camera;
    }
    if (renderer?.domElement) {
      this.rendererDom = renderer.domElement;
    }
  }

  apply(state: ChartState, ctx: WidgetRenderContext): void {
    this.lastState = state;
    this.lastCoords = ctx.coords;
    this.lastEffectiveTheme = resolveChartTheme(state.theme);
    this.lastTooltipState = state.tooltip ?? null;
    if (!this.scene) {
      console.error(`[ChartWidget] apply() called but scene is null for id="${this.widgetId}" — widget not initialized`);
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      validateNVSScalar(state.nvsX, 'nvsX', `ChartWidget(${this.widgetId})`);
      validateNVSScalar(state.nvsY, 'nvsY', `ChartWidget(${this.widgetId})`);
      validateNVSScalar(state.bounds.width, 'bounds.width', `ChartWidget(${this.widgetId})`);
      validateNVSScalar(state.bounds.height, 'bounds.height', `ChartWidget(${this.widgetId})`);
    }

    // ── Inline data registration (reference-equality guard) ─────────────────
    // Register inline rows on first apply or when the rows array reference changes.
    // Avoids redundant store writes every frame when rows are stable.
    // V2.1: when useLiveChartData is active, skip SceneTrack-baked write.
    if (state.dataSource.type === 'inline') {
      if (this.store.hasLiveOverride(this.widgetId)) {
        // useLiveChartData owns this widget's data — skip SceneTrack-baked write.
        // store.registerInline() + setLiveOverride() already called by the hook.
      } else {
        if (state.dataSource.rows !== this.lastInlineRowsRef) {
          this.store.registerInline(this.widgetId, state.dataSource.rows);
          this.lastInlineRowsRef = state.dataSource.rows;
        }
      }
    }

    // Convert NVS position to world-space center using the live NVSCoordService.
    const [wcx, wcy, wcz] = ctx.coords.toWorld(state.nvsX, state.nvsY, state.z);

    // Convert NVS size fractions to world-space dimensions.
    const [worldW, worldH] = ctx.coords.toWorldSize(state.bounds.width, state.bounds.height);

    // Chart content starts at group-local (0, 0) and extends to (worldW, worldH).
    // Subtract half-bounds to center it on the NVS position.
    const worldPos: readonly [number, number, number] = [
      wcx - worldW / 2,
      wcy - worldH / 2,
      wcz,
    ];

    const renderInput: ChartRenderInput = {
      ...state,
      bounds: { width: worldW, height: worldH, depth: state.bounds.depth },
      position: worldPos,
      // V2.1: pass entryT only when animation is in progress (< 1.0)
      entryT: this.currentEntryT < 1.0 ? this.currentEntryT : undefined,
      // V2.1: pass function accessors from useChartAccessors() registry
      accessors: this.accessorRegistry?.get(this.widgetId),
    };

    this.chartRenderer.update(renderInput, this.widgetId);

    // Attach or detach DOM listeners based on interactive flag
    if (state.interactive && !this.mousemoveListener && this.rendererDom) {
      this.attachDomListeners(this.rendererDom);
    } else if (!state.interactive && this.mousemoveListener) {
      this.detachDomListeners();
    }
  }

  // ── IAnimationController ──────────────────────────────────────────────────

  onTick(ctx: AnimationTickContext): void {
    if (!this.lastState) return;
    const state = this.lastState;

    // ── Entry animation (all chart types, rendered by BarRenderer only in V2.1) ──
    if (state.animateEntry) {
      const blockProgress = ctx.tick?.blockProgress ?? 0;
      const duration = state.animationDuration;
      this.currentEntryT = duration > 0 ? Math.min(blockProgress / duration, 1.0) : 1.0;
    } else {
      this.currentEntryT = 1.0;
    }

    // ── Projection beam animation tick ───────────────────────────────────────
    if (this.lastEffectiveTheme) {
      this.chartRenderer.tickProjection(this.lastEffectiveTheme);
    }

    // ── Heatmap time-slice animation ─────────────────────────────────────────
    if (state.typeConfig.kind !== 'heatmap') return;
    const opts = state.typeConfig.options;
    if (!opts.timeField || !this.lastCoords) return;

    const sourceName = this.resolveSourceName(state.dataSource);
    const totalSlices = this.store.getTimeSliceCount(sourceName, opts.timeField);
    if (totalSlices === 0) return;

    const blockProgress = ctx.tick?.blockProgress ?? 0;
    const sliceIndex = Math.min(
      Math.floor(blockProgress * totalSlices),
      totalSlices - 1,
    );

    // Compute world-space position (same as apply())
    const [wcx, wcy, wcz] = this.lastCoords.toWorld(state.nvsX, state.nvsY, state.z);
    const [worldW, worldH] = this.lastCoords.toWorldSize(state.bounds.width, state.bounds.height);
    const worldPos: readonly [number, number, number] = [
      wcx - worldW / 2,
      wcy - worldH / 2,
      wcz,
    ];

    this.chartRenderer.updateHeatmapSlice(
      sliceIndex,
      {
        ...state,
        bounds: { width: worldW, height: worldH, depth: state.bounds.depth },
        position: worldPos,
      },
      this.widgetId,
    );
  }

  dispose(): void {
    chartTooltipStore.clear(this.widgetId);
    // Unsubscribe from deregisterInline callbacks to prevent stale calls after dispose
    this.unsubscribeDeregister();
    this.detachDomListeners();
    if (this.scene) {
      this.chartRenderer.dispose(this.scene);
      this.scene = null;
    }
    this.camera = null;
    this.lastCoords = null;
    this.lastInlineRowsRef = null;
    this.lastEffectiveTheme = null;
    this.lastTooltipState = null;
  }

  // ── Interaction helpers ───────────────────────────────────────────────────

  /**
   * Returns the Three.js camera used for chart rendering.
   * Returns null if the widget has not been initialized or the camera is unavailable.
   */
  public getCamera(): THREE.Camera | null {
    return this.camera;
  }

  /**
   * Returns the pixel dimensions of the renderer's DOM element.
   * Used by ChartTooltipOverlay to project NDC to pixel offsets within
   * the AR-locked container.
   * Returns null if the widget has not been initialized.
   */
  public getContainerSize(): { width: number; height: number } | null {
    if (!this.rendererDom) return null;
    return {
      width: this.rendererDom.offsetWidth,
      height: this.rendererDom.offsetHeight,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Resolves a ChartStateDataSource to the store key name.
   * Async source returns empty string if not yet loaded (store has no data).
   */
  private resolveSourceName(dataSource: ChartStateDataSource): string {
    switch (dataSource.type) {
      case 'inline': return `__inline__${this.widgetId}`;
      case 'named':  return dataSource.name;
      case 'async':  return this.asyncDataLoaded ? `__async__${this.widgetId}` : '';
    }
  }

  private attachDomListeners(dom: HTMLElement): void {
    this.mousemoveListener = (e: MouseEvent) => this.handleMouseMove(e, dom);
    this.mouseleaveListener = () => {
      // Guard on lastTooltipState — same rule as handleMouseMove
      if (this.lastTooltipState) {
        chartTooltipStore.clear(this.widgetId);
      }
      if (this.lastTooltipState?.projection) {
        this.chartRenderer.updateProjection(null, this.lastEffectiveTheme ?? darkGlassChartTheme);
      }
      this.onHover?.(null);
    };
    this.clickListener = (e: MouseEvent) => this.handleClick(e, dom);
    dom.addEventListener('mousemove', this.mousemoveListener);
    dom.addEventListener('mouseleave', this.mouseleaveListener);
    dom.addEventListener('click', this.clickListener);
  }

  private detachDomListeners(): void {
    if (this.rendererDom && this.mousemoveListener) {
      this.rendererDom.removeEventListener('mousemove', this.mousemoveListener);
      this.rendererDom.removeEventListener('mouseleave', this.mouseleaveListener!);
      this.rendererDom.removeEventListener('click', this.clickListener!);
    }
    this.mousemoveListener = null;
    this.mouseleaveListener = null;
    this.clickListener = null;
  }

  private getNdc(e: MouseEvent, dom: HTMLElement): THREE.Vector2 | null {
    const rect = dom.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const nvsBounds = this.nvsBounds;
    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;
    const regionLeft   = nvsBounds.x * rect.width;
    const regionTop    = nvsBounds.y * rect.height;
    const regionWidth  = nvsBounds.w * rect.width;
    const regionHeight = nvsBounds.h * rect.height;
    if (regionWidth <= 0 || regionHeight <= 0) return null;
    const subX = pointerX - regionLeft;
    const subY = pointerY - regionTop;
    return new THREE.Vector2(
      (subX / regionWidth) * 2 - 1,
      -(subY / regionHeight) * 2 + 1,
    );
  }

  private raycast(e: MouseEvent, dom: HTMLElement): import('../../renderers/shared/IChartRenderer').ChartHitInfo | null {
    if (!this.scene) return null;
    const camera = this.getCamera();
    if (!camera) return null;
    const ndc = this.getNdc(e, dom);
    if (!ndc) return null;

    this.raycaster.setFromCamera(ndc, camera);
    const targets = this.chartRenderer.getInteractiveObjects();
    const intersections = this.raycaster.intersectObjects(targets, false);
    if (intersections.length === 0) return null;

    return this.chartRenderer.resolveHoverInfo(intersections[0]!);
  }

  private handleMouseMove(e: MouseEvent, dom: HTMLElement): void {
    const info = this.raycast(e, dom);
    const theme = this.lastEffectiveTheme ?? darkGlassChartTheme;

    if (info) {
      // Only publish to tooltip store when <ChartTooltip> is present in DSL
      if (this.lastTooltipState) {
        const { x, y } = this.projectHitPoint(info.point, dom);
        chartTooltipStore.publish(
          this.widgetId, x, y, info, theme.tooltip ?? null, this.lastTooltipState.format,
        );
      }
      // Update projection beam if explicitly enabled
      if (this.lastTooltipState?.projection) {
        this.chartRenderer.updateProjection(info, theme);
      }
    } else {
      // Clear tooltip store only if we were publishing to it
      if (this.lastTooltipState) {
        chartTooltipStore.clear(this.widgetId);
      }
      if (this.lastTooltipState?.projection) {
        this.chartRenderer.updateProjection(null, theme);
      }
    }

    // Backward-compat: still call onHover callback
    this.onHover?.(info);
  }

  private projectHitPoint(
    point: readonly [number, number, number],
    dom: HTMLElement,
  ): { x: number; y: number } {
    const camera = this.camera;
    if (!camera) return { x: 0, y: 0 };

    const worldPoint = new THREE.Vector3(point[0], point[1], point[2]);
    worldPoint.project(camera);

    return projectNdcToNvsPixels(
      worldPoint.x,
      worldPoint.y,
      dom.offsetWidth,
      dom.offsetHeight,
      this.nvsBounds,
    );
  }

  private handleClick(e: MouseEvent, dom: HTMLElement): void {
    if (!this.onSelect) return;
    const info = this.raycast(e, dom);
    if (info) this.onSelect(info);
  }
}

// Required for IDslComposite — React.ComponentType must be imported
import type React from 'react';

// Re-export stubs for backward-compat with importers that still reference them from ChartWidget.
// The canonical location is ./stubs — these re-exports will be removed once all callers migrate.
export {
  Chart,
  BarChart,
  LineChart,
  ScatterPlotChart,
  PieChart,
  AreaChart,
  HeatMapChart,
  ChartData,
  ChartAxis,
  ChartSeries,
  ChartLegend,
  ChartDataLabels,
  ReferenceLine,
} from './stubs';
