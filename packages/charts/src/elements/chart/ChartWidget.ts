// ChartWidget — ISceneElement + IRenderable + IAnimationController + IDslComposite.

import * as THREE from 'three';
import { functionalChartTransitionSpec } from './compile';
import { ChartRenderer } from './render';
import type { ChartProps, ChartDataProps, ChartAxisProps, ChartSeriesProps, ChartLegendProps } from './dsl';
import type { ChartState } from './types';
import { DEFAULT_CHART_STATE } from './types';
import type { ChartDataStore } from '../../data/ChartDataStore';
import {
  nvsToWorldWithCamera,
  nvsToWorldAnalytic,
} from '@brewsite/core';
import type {
  ISceneElement,
  IRenderable,
  IAnimationController,
  IDslComposite,
  INVSBounded,
  NVSRect,
  WidgetInitContext,
  WidgetRenderContext,
  AnimationTickContext,
} from '@brewsite/core';
import type { ChartHitInfo } from '../../renderers/shared/IChartRenderer';

/** Information passed to onHover and onSelect callbacks. */
export type ChartHoverInfo = ChartHitInfo;

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

/**
 * Widget for a single 3D chart element.
 *
 * Implements:
 * - ISceneElement<ChartState> — DSL component + transition spec
 * - IRenderable<ChartState> — Three.js lifecycle (initialize, apply, dispose)
 * - IAnimationController — heatmap time-slice animation tick
 * - IDslComposite — routes child DSL components (ChartData, ChartAxis, etc.)
 */
export class ChartWidget
  implements
    ISceneElement<ChartState>,
    IRenderable<ChartState>,
    IAnimationController,
    IDslComposite,
    INVSBounded
{
  readonly widgetId: string;
  readonly defaultState: ChartState = DEFAULT_CHART_STATE;
  readonly transitionSpec = functionalChartTransitionSpec;
  readonly DslComponent = Chart;
  readonly tickPriority = 2; // after CameraWidget(0) and DiagramWidget(1)

  /**
   * Returns the NVS bounds of the chart within the AR-locked container.
   * Returns the fullscreen default { x: 0, y: 0, w: 1, h: 1 } until the first apply().
   */
  get nvsBounds(): NVSRect {
    return this.lastState?.nvsBounds ?? DEFAULT_CHART_STATE.nvsBounds;
  }

  readonly childDslComponents: IDslComposite['childDslComponents'] = [
    { component: ChartData as React.ComponentType<unknown>,   displayName: 'ChartData' },
    { component: ChartAxis as React.ComponentType<unknown>,   displayName: 'ChartAxis' },
    { component: ChartSeries as React.ComponentType<unknown>, displayName: 'ChartSeries' },
    { component: ChartLegend as React.ComponentType<unknown>, displayName: 'ChartLegend' },
  ];

  /** Called on hover interaction when interactive=true. */
  public onHover: ((info: ChartHoverInfo | null) => void) | undefined = undefined;

  /** Called on click interaction when interactive=true. */
  public onSelect: ((info: ChartHoverInfo) => void) | undefined = undefined;

  private readonly chartRenderer: ChartRenderer;
  private scene: THREE.Scene | null = null;
  private rendererDom: HTMLElement | null = null;
  private cameraRef: THREE.PerspectiveCamera | null = null;
  private camera: THREE.Camera | null = null;
  private lastState: ChartState | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private mousemoveListener: ((e: MouseEvent) => void) | null = null;
  private mouseleaveListener: (() => void) | null = null;
  private clickListener: ((e: MouseEvent) => void) | null = null;

  constructor(widgetId: string, store: ChartDataStore) {
    this.widgetId = widgetId;
    this.chartRenderer = new ChartRenderer(store);
  }

  initialize({ scene, renderer, camera }: WidgetInitContext): void {
    this.scene = scene;
    this.chartRenderer.mount(scene);
    if (camera) {
      this.cameraRef = camera;
      this.camera = camera;
    }
    if (renderer?.domElement) {
      this.rendererDom = renderer.domElement;
    }
  }

  apply(state: ChartState, _ctx: WidgetRenderContext): void {
    this.lastState = state;
    if (!this.scene) {
      console.error(`[ChartWidget] apply() called but scene is null for id="${this.widgetId}" — widget not initialized`);
      return;
    }

    // Convert NVS position to world-space using the live camera when available.
    const cam = this.cameraRef;
    const worldPos = cam
      ? nvsToWorldWithCamera(state.nvsX, state.nvsY, cam, state.z)
      : nvsToWorldAnalytic(state.nvsX, state.nvsY, 0, 0, 12.07, 45, 16 / 9, state.z);

    this.chartRenderer.update({ ...state, position: worldPos }, this.widgetId);

    // Attach or detach DOM listeners based on interactive flag
    if (state.interactive && !this.mousemoveListener && this.rendererDom) {
      this.attachDomListeners(this.rendererDom);
    } else if (!state.interactive && this.mousemoveListener) {
      this.detachDomListeners();
    }
  }

  onTick(ctx: AnimationTickContext): void {
    // Heatmap time-slice animation
    if (this.lastState?.type !== 'heatmap' || !this.lastState.timeField) return;
    const sliceProgress = ctx.tick?.blockProgress ?? 0;
    // Re-apply with same state — heatmap renderer derives slice from store.getTimeSlice()
    // NOTE: for animated heatmaps, the consuming scene should have multiple ticks
    // with blockProgress varying 0→1 over the desired time range.
    if (this.scene) {
      // Re-apply same state — heatmap renderer derives slice from store.getTimeSlice().
      // Must convert NVS → world-space position same as apply().
      const heatCam = this.cameraRef;
      const heatWorldPos = heatCam
        ? nvsToWorldWithCamera(this.lastState.nvsX, this.lastState.nvsY, heatCam, this.lastState.z)
        : nvsToWorldAnalytic(this.lastState.nvsX, this.lastState.nvsY, 0, 0, 12.07, 45, 16 / 9, this.lastState.z);
      this.chartRenderer.update({ ...this.lastState, position: heatWorldPos }, this.widgetId);
    }
  }

  dispose(): void {
    this.detachDomListeners();
    if (this.scene) {
      this.chartRenderer.dispose(this.scene);
      this.scene = null;
    }
    this.cameraRef = null;
    this.camera = null;
  }

  private attachDomListeners(dom: HTMLElement): void {
    this.mousemoveListener = (e: MouseEvent) => this.handleMouseMove(e, dom);
    this.mouseleaveListener = () => this.onHover?.(null);
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

  /**
   * Returns the Three.js camera used for chart rendering.
   * Returns null if the widget has not been initialized or the camera is unavailable.
   */
  public getCamera(): THREE.Camera | null {
    return this.cameraRef;
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
    if (!this.onHover) return;
    const info = this.raycast(e, dom);
    this.onHover(info);
  }

  private handleClick(e: MouseEvent, dom: HTMLElement): void {
    if (!this.onSelect) return;
    const info = this.raycast(e, dom);
    if (info) this.onSelect(info);
  }
}

// Required for IDslComposite — React.ComponentType must be imported
import type React from 'react';
