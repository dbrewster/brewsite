// ViewWidget — IRenderable<ViewState> that applies delta transforms and opacity
// to child widgets via IViewChild, without reparenting or group ownership.

import * as THREE from 'three';
import type { IRenderable, IViewChild, IWidget, WidgetInitContext, WidgetRenderContext } from '../../widget/types';
import { isViewChild } from '../../widget/WidgetRegistry';
import type { ViewState } from '../../compiler/viewTypes';

/**
 * IRenderable widget for ViewLayout carousel repositioning.
 *
 * Created lazily by corePlugin.reconcileCompiledTrack.
 *
 * Key change from previous implementation: no THREE.Group, no reparenting.
 * Position/scale transforms are applied as deltas to each child widget's
 * root Object3D. Opacity is delegated via IViewChild.applyViewOpacity().
 */
export class ViewWidget implements IRenderable<ViewState> {
  readonly widgetId: string;
  private scene: THREE.Scene | null = null;

  /** Compile-time View center in NVS coords — captured on first apply(). */
  private originalNvsCenter: { x: number; y: number } | null = null;
  /** Compile-time scale — captured on first apply(). */
  private originalScale: number | null = null;
  /** Compile-time Z — captured on first apply(). */
  private originalZ: number | null = null;
  /** Last opacity value — for short-circuiting. */
  private lastAppliedOpacity: number | null = null;

  /** Resolved IViewChild widgets, populated lazily. */
  private viewChildren: IViewChild[] = [];
  private resolvedChildren = false;

  /** Child widget IDs from compiled state. */
  private childWidgetIds: readonly string[] = [];

  /**
   * Callback to look up a child widget by ID.
   * Passed at construction time by corePlugin's reconcileCompiledTrack.
   */
  private readonly resolveChildWidget: (widgetId: string) => IWidget | undefined;

  /**
   * Callback to look up a child widget's root THREE.Object3D for positioning.
   * This is NOT IGroupOwner — it uses the runtime's widget-to-object mapping.
   */
  private readonly resolveChildObject: (widgetId: string) => THREE.Object3D | null;

  /**
   * Per-child original world positions, captured on first apply for delta computation.
   */
  private childOriginalPositions = new Map<string, THREE.Vector3>();

  constructor(
    viewId: string,
    resolveChildWidget: (widgetId: string) => IWidget | undefined,
    resolveChildObject: (widgetId: string) => THREE.Object3D | null,
  ) {
    this.widgetId = viewId;
    this.resolveChildWidget = resolveChildWidget;
    this.resolveChildObject = resolveChildObject;
  }

  initialize({ scene }: WidgetInitContext): void {
    this.scene = scene;
  }

  apply(state: ViewState, ctx: WidgetRenderContext): void {
    // Lazy resolve children on first apply with childWidgetIds.
    if (!this.resolvedChildren && state.childWidgetIds.length > 0) {
      this.childWidgetIds = state.childWidgetIds;
      this.resolveViewChildren();
    }

    // Capture original center, scale, Z on first valid apply.
    if (!this.originalNvsCenter) {
      this.originalNvsCenter = {
        x: state.bounds.x + state.bounds.w / 2,
        y: state.bounds.y + state.bounds.h / 2,
      };
    }
    if (this.originalScale === null) {
      this.originalScale = state.scale;
    }
    if (this.originalZ === null) {
      this.originalZ = state.z;
    }

    const scaleRatio = state.scale / this.originalScale;

    // Compute world-space delta from NVS center shift.
    const newCenterNvs = {
      x: state.bounds.x + state.bounds.w / 2,
      y: state.bounds.y + state.bounds.h / 2,
    };
    const [newCx, newCy] = ctx.coords.toWorld(newCenterNvs.x, newCenterNvs.y, 0);
    const [oldCx, oldCy] = ctx.coords.toWorld(
      this.originalNvsCenter.x,
      this.originalNvsCenter.y,
      0,
    );

    // Apply delta position and scale to each child object.
    const deltaX = newCx - oldCx * scaleRatio;
    const deltaY = newCy - oldCy * scaleRatio;
    const deltaZ = state.z - this.originalZ;

    for (const childId of this.childWidgetIds) {
      const obj = this.resolveChildObject(childId);
      if (!obj) continue;

      // Capture original position on first encounter.
      if (!this.childOriginalPositions.has(childId)) {
        this.childOriginalPositions.set(childId, obj.position.clone());
      }
      const orig = this.childOriginalPositions.get(childId)!;

      obj.position.set(
        orig.x * scaleRatio + deltaX,
        orig.y * scaleRatio + deltaY,
        orig.z + deltaZ,
      );
      obj.scale.set(scaleRatio, scaleRatio, 1);
      obj.visible = state.opacity > 0;
    }

    // Delegate opacity to IViewChild widgets.
    if (state.opacity !== this.lastAppliedOpacity) {
      for (const child of this.viewChildren) {
        child.applyViewOpacity(state.opacity);
      }
      this.lastAppliedOpacity = state.opacity;
    }
  }

  dispose(): void {
    this.scene = null;
    this.viewChildren = [];
    this.resolvedChildren = false;
    this.originalNvsCenter = null;
    this.originalScale = null;
    this.originalZ = null;
    this.lastAppliedOpacity = null;
    this.childOriginalPositions.clear();
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private resolveViewChildren(): void {
    this.viewChildren = [];
    for (const childId of this.childWidgetIds) {
      const widget = this.resolveChildWidget(childId);
      if (widget && isViewChild(widget)) {
        this.viewChildren.push(widget);
      }
    }
    this.resolvedChildren = true;
  }
}
