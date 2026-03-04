// ChartWidget — ISceneElement + IRenderable + IAnimationController + IDslComposite.

import * as THREE from 'three';
import { functionalChartTransitionSpec } from './compile';
import { ChartRenderer } from './render';
import { Chart, ChartData, ChartAxis, ChartSeries, ChartLegend } from './dsl';
import type { ChartState } from './types';
import { DEFAULT_CHART_STATE } from './types';
import type { ChartDataStore } from '../../data/ChartDataStore';
import {
  SCENE_CAMERA_KEY,
} from '@brewsite/core';
import type {
  ISceneElement,
  IRenderable,
  IAnimationController,
  IDslComposite,
  WidgetInitContext,
  WidgetRenderContext,
  AnimationTickContext,
} from '@brewsite/core';
import type { ChartHitInfo } from '../../renderers/shared/IChartRenderer';

/** Information passed to onHover and onSelect callbacks. */
export type ChartHoverInfo = ChartHitInfo;

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
    IDslComposite
{
  readonly widgetId: string;
  readonly defaultState: ChartState = DEFAULT_CHART_STATE;
  readonly transitionSpec = functionalChartTransitionSpec;
  readonly DslComponent = Chart;
  readonly tickPriority = 2; // after CameraWidget(0) and DiagramWidget(1)

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

  initialize({ scene, renderer }: WidgetInitContext): void {
    this.scene = scene;
    this.chartRenderer.mount(scene);
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

    this.chartRenderer.update(state, this.widgetId);

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
      this.chartRenderer.update(this.lastState, this.widgetId);
    }
  }

  dispose(): void {
    this.detachDomListeners();
    if (this.scene) {
      this.chartRenderer.dispose(this.scene);
      this.scene = null;
    }
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

  private getCamera(): THREE.Camera | null {
    if (!this.scene) return null;
    if (!this.camera) {
      // Camera is stored on scene.userData by CameraWidget
      const cam = (this.scene.userData as Record<string, unknown>)[SCENE_CAMERA_KEY];
      if (cam instanceof THREE.Camera) this.camera = cam;
    }
    return this.camera;
  }

  private getNdc(e: MouseEvent, dom: HTMLElement): THREE.Vector2 | null {
    const rect = dom.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
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
