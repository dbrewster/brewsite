// ViewWidget — IRenderable<ViewState> that owns a THREE.Group for carousel repositioning.
// Runtime-only widget: state is produced by viewHandler, not by a dedicated DSL component.
// Does NOT implement ISceneElement — no DslComponent, no defaultState, no transitionSpec.

import * as THREE from 'three';
import type { IRenderable, WidgetInitContext, WidgetRenderContext } from '../../widget/types';
import type { ViewState } from '../../compiler/viewTypes';

/**
 * IRenderable widget that owns a THREE.Group used to apply delta transforms
 * for carousel repositioning. Child 3D widgets are re-parented under this
 * Group after initialization so they move as a unit when carousel bounds change.
 *
 * Created lazily by corePlugin.reconcileCompiledTrack — never constructed directly
 * by scene authors.
 */
export class ViewWidget implements IRenderable<ViewState> {
  readonly widgetId: string;
  private scene: THREE.Scene | null = null;
  private readonly group = new THREE.Group();

  /** Compile-time View center in NVS coords — captured on first apply(). */
  private originalNvsCenter: { x: number; y: number } | null = null;

  /**
   * Compile-time scale — captured on first apply(). Not hardcoded to 1.0 because
   * inactive carousel views can start with scale !== 1.0 (inactiveScale^distance).
   */
  private originalScale: number | null = null;

  /**
   * Compile-time Z position — captured on first apply(). Children's compiled Z
   * positions already include the view's Z offset via composeZ(), so the group
   * must apply only the delta (state.z - originalZ) to avoid double-counting.
   */
  private originalZ: number | null = null;

  /** Last opacity value — used to short-circuit applyOpacity traversal. */
  private lastAppliedOpacity: number | null = null;

  /** Child widget IDs — populated on first apply() from ViewState. */
  private childWidgetIds: readonly string[] = [];
  private reparented = false;

  /**
   * Callback to look up a child widget's root THREE.Object3D.
   * Passed at construction time by corePlugin's reconcileCompiledTrack.
   */
  private readonly resolveChildRoot: (widgetId: string) => THREE.Object3D | null;

  constructor(
    viewId: string,
    resolveChildRoot: (widgetId: string) => THREE.Object3D | null,
  ) {
    this.widgetId = viewId;
    this.resolveChildRoot = resolveChildRoot;
    this.group.name = `view-group-${viewId}`;
  }

  initialize({ scene }: WidgetInitContext): void {
    this.scene = scene;
    scene.add(this.group);
  }

  apply(state: ViewState, ctx: WidgetRenderContext): void {
    // Lazy reparent: on first apply with childWidgetIds, move children into group.
    if (!this.reparented && state.childWidgetIds.length > 0) {
      this.childWidgetIds = state.childWidgetIds;
      this.reparentChildren();
    }

    // Capture original center and scale on first valid apply.
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

    // Current NVS center
    const newCenterNvs = {
      x: state.bounds.x + state.bounds.w / 2,
      y: state.bounds.y + state.bounds.h / 2,
    };

    // Convert NVS centers to world space
    const [newCx, newCy] = ctx.coords.toWorld(newCenterNvs.x, newCenterNvs.y, 0);
    const [oldCx, oldCy] = ctx.coords.toWorld(
      this.originalNvsCenter.x,
      this.originalNvsCenter.y,
      0,
    );

    // G = P_new - P_old * S
    this.group.position.set(
      newCx - oldCx * scaleRatio,
      newCy - oldCy * scaleRatio,
      state.z - this.originalZ,   // delta, not direct — avoids double-counting with composeZ()
    );
    this.group.scale.set(scaleRatio, scaleRatio, 1);
    this.group.visible = state.opacity > 0;

    // Apply opacity to all mesh materials in the group.
    // Short-circuit when opacity hasn't changed to avoid per-frame traversal cost.
    if (state.opacity !== this.lastAppliedOpacity) {
      this.applyOpacity(state.opacity);
      this.lastAppliedOpacity = state.opacity;
    }
  }

  dispose(): void {
    // Do NOT reparent children back to the scene root. When the Group has a
    // non-identity transform (G≠0, S≠1), Three.js preserves children's local
    // positions on reparent, causing a world-transform jump. Since dispose() is
    // called during teardown, children are destroyed with the group — no
    // reparenting needed.
    this.scene?.remove(this.group);
    this.scene = null;
    this.reparented = false;
    this.originalNvsCenter = null;
    this.originalScale = null;
    this.originalZ = null;
    this.lastAppliedOpacity = null;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private reparentChildren(): void {
    for (const childId of this.childWidgetIds) {
      const obj = this.resolveChildRoot(childId);
      if (obj && obj.parent !== this.group) {
        this.group.add(obj); // Three.js auto-removes from previous parent
      }
    }
    this.reparented = true;
  }

  private applyOpacity(opacity: number): void {
    this.group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh) || !obj.material) return;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of materials) {
        if (!('opacity' in mat)) continue;
        // Capture base opacity on first encounter so future calls can scale correctly.
        if (mat.userData._viewBaseOpacity === undefined) {
          mat.userData._viewBaseOpacity = mat.opacity;
        }
        mat.opacity = opacity * (mat.userData._viewBaseOpacity as number);
        mat.transparent = mat.opacity < 1;
      }
    });
  }
}
