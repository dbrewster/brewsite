// ViewWidget — IRenderable<ViewState> that applies delta transforms and opacity
// to child widgets via IViewChild, without reparenting or group ownership.

import * as THREE from 'three';
import type { IRenderable, IViewChild, IWidget, WidgetInitContext, WidgetRenderContext } from '../../widget/types';
import { isViewChild } from '../../widget/WidgetRegistry';
import type { ViewState } from '../../compiler/viewTypes';

/** Lerp factor per frame for smooth carousel transitions. 0.12 ≈ 60fps ease. */
const LERP_FACTOR = 0.12;

/**
 * IRenderable widget for ViewLayout carousel repositioning.
 *
 * Created lazily by corePlugin.reconcileCompiledTrack.
 *
 * Key change from previous implementation: no THREE.Group, no reparenting.
 * Position/scale transforms are applied as deltas to each child widget's
 * root Object3D. Opacity is delegated via IViewChild.applyViewOpacity().
 *
 * Carousel transitions are animated: position, scale, z, and opacity lerp
 * smoothly toward the target state each frame, producing a fluid ring/fan
 * rotation effect instead of hard snaps.
 */
export class ViewWidget implements IRenderable<ViewState> {
  readonly widgetId: string;

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

  /**
   * Current interpolated position/scale/z per child for smooth animation.
   * Keys: childId → { x, y, z, scaleRatio }.
   */
  private childCurrentState = new Map<string, { x: number; y: number; z: number; scaleRatio: number }>();

  /** Current interpolated opacity. */
  private currentOpacity: number | null = null;

  /**
   * Current world-space center of this view, updated each apply().
   * Exposed for other widgets (e.g., carousel highlight) that need to
   * track this view's live position without reading child Object3D offsets.
   */
  currentWorldCenter: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };

  constructor(
    viewId: string,
    resolveChildWidget: (widgetId: string) => IWidget | undefined,
    resolveChildObject: (widgetId: string) => THREE.Object3D | null,
  ) {
    this.widgetId = viewId;
    this.resolveChildWidget = resolveChildWidget;
    this.resolveChildObject = resolveChildObject;
  }

  initialize(_ctx: WidgetInitContext): void {
    // Scene ref not currently needed — children manage their own scene objects.
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

    const targetScaleRatio = state.scale / this.originalScale;

    // Compute world-space target from NVS center shift.
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

    const targetDeltaX = newCx - oldCx * targetScaleRatio;
    const targetDeltaY = newCy - oldCy * targetScaleRatio;
    const targetDeltaZ = state.z - this.originalZ;
    const targetOpacity = state.opacity;

    // Expose the current world center for external consumers (e.g., highlights).
    this.currentWorldCenter = { x: newCx, y: newCy, z: state.z };

    // Apply with lerp animation to each child object.
    for (const childId of this.childWidgetIds) {
      const obj = this.resolveChildObject(childId);
      if (!obj) continue;

      // Capture original position on first encounter.
      if (!this.childOriginalPositions.has(childId)) {
        this.childOriginalPositions.set(childId, obj.position.clone());
      }
      const orig = this.childOriginalPositions.get(childId)!;

      // Compute target position.
      const targetX = orig.x * targetScaleRatio + targetDeltaX;
      const targetY = orig.y * targetScaleRatio + targetDeltaY;
      const targetZ = orig.z + targetDeltaZ;

      // Get or initialize current interpolated state.
      let current = this.childCurrentState.get(childId);
      if (!current) {
        // First frame for this child: snap to target immediately (no lerp).
        current = { x: targetX, y: targetY, z: targetZ, scaleRatio: targetScaleRatio };
        this.childCurrentState.set(childId, current);
      } else {
        // Subsequent frames: lerp toward target for smooth carousel animation.
        current.x += (targetX - current.x) * LERP_FACTOR;
        current.y += (targetY - current.y) * LERP_FACTOR;
        current.z += (targetZ - current.z) * LERP_FACTOR;
        current.scaleRatio += (targetScaleRatio - current.scaleRatio) * LERP_FACTOR;
      }

      obj.position.set(current.x, current.y, current.z);
      obj.scale.set(current.scaleRatio, current.scaleRatio, 1);
      // Only HIDE when view opacity reaches 0. Don't force-show — child widgets
      // manage their own visibility via apply() (e.g., DiagramWidget sets
      // visible=true when enabled, visible=false when absent via disableWhenAbsent).
      // Force-showing here would stomp that disabled state every tick.
      if (targetOpacity <= 0) {
        obj.visible = false;
      }
    }

    // Lerp opacity toward target. First frame snaps; subsequent frames lerp.
    if (this.currentOpacity === null) {
      this.currentOpacity = targetOpacity;
    } else if (this.currentOpacity !== targetOpacity) {
      this.currentOpacity += (targetOpacity - this.currentOpacity) * LERP_FACTOR;
    }

    // Only update opacity delegates when the value actually changed.
    const snappedOpacity = Math.abs(this.currentOpacity - targetOpacity) < 0.01
      ? targetOpacity
      : this.currentOpacity;

    if (snappedOpacity !== this.lastAppliedOpacity) {
      for (const child of this.viewChildren) {
        child.applyViewOpacity(snappedOpacity);
      }
      this.lastAppliedOpacity = snappedOpacity;
    }
  }

  dispose(): void {
    this.viewChildren = [];
    this.resolvedChildren = false;
    this.originalNvsCenter = null;
    this.originalScale = null;
    this.originalZ = null;
    this.lastAppliedOpacity = null;
    this.currentOpacity = null;
    this.childOriginalPositions.clear();
    this.childCurrentState.clear();
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
