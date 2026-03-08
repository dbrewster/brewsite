// Three.js rendering for DiagramCanvasState.
// Orchestrates child DiagramRenderers and pipe EdgeRenderer.

import * as THREE from 'three';
import type { DiagramCanvasState } from './types';
import { DiagramRenderer } from '../render';
import { EdgeRenderer } from '../rendering/EdgeRenderer';
import { EdgeMaterialFactory } from '../rendering/EdgeMaterialFactory';

export class DiagramCanvasRenderer {
  private canvasGroup: THREE.Group | null = null;
  private pipeRoot: THREE.Group | null = null;
  private diagramRenderers = new Map<string, DiagramRenderer>();
  private pipeRenderer: EdgeRenderer | null = null;

  /**
   * Updates the canvas geometry group in the provided scene.
   *
   * The scene passed here MUST be the widget's private diagram scene,
   * not the main Three.js scene. DiagramCanvasWidget owns the private scene
   * and passes it here on every apply() call.
   *
   * @param state         Compiled canvas state (tilt, scale, nvsBounds).
   * @param scene         Private THREE.Scene owned by DiagramCanvasWidget.
   * @param canvasAspect  (nvsBounds.w / nvsBounds.h) × engineAspect.
   * @param panOffset     Input-accumulated translation [dx, dy, dz] in world units.
   * @param rotationOffset Additional pitch offset in radians (from interactive rotate).
   */
  update(
    state: DiagramCanvasState,
    scene: THREE.Scene,
    canvasAspect: number,
    panOffset: readonly [number, number, number],
    rotationOffset: number,
  ): void {
    if (!this.canvasGroup) {
      this.canvasGroup = new THREE.Group();
      this.canvasGroup.name = `canvas:${state.id}`;
      this.pipeRoot = new THREE.Group();
      this.pipeRoot.name = `canvas:${state.id}:pipes`;
      this.canvasGroup.add(this.pipeRoot);
      scene.add(this.canvasGroup);
      // Canvas pipe renderer uses default EdgeRenderer construction (tubeRadialSegments=8).
      // Cross-diagram pipes are a canvas-level concept with no per-diagram theme — defaults are intentional.
      this.pipeRenderer = new EdgeRenderer(new EdgeMaterialFactory());
    }

    // Position: pan offset only (no authored world position in new model).
    this.canvasGroup.position.set(panOffset[0], panOffset[1], panOffset[2]);
    // Rotation: authored tilt + interactive rotation offset.
    this.canvasGroup.rotation.set(state.tilt + rotationOffset, 0, 0);
    // Scale: authored world-space scale.
    this.canvasGroup.scale.setScalar(state.scale);

    const activeDiagramIds = new Set(state.diagrams.map((d) => d.id));
    for (const [id, renderer] of this.diagramRenderers) {
      if (!activeDiagramIds.has(id)) {
        renderer.dispose(id, this.canvasGroup);
        this.diagramRenderers.delete(id);
      }
    }

    for (const diagramState of state.diagrams) {
      if (!this.diagramRenderers.has(diagramState.id)) {
        this.diagramRenderers.set(diagramState.id, new DiagramRenderer(diagramState.themeConfig));
      }
      const dr = this.diagramRenderers.get(diagramState.id)!;
      dr.setCanvasAspect(canvasAspect);
      dr.update(diagramState, this.canvasGroup);
    }

    const activePipeIds = new Set(state.pipes.map((p) => p.id));
    for (const id of this.pipeRenderer!.ids) {
      if (!activePipeIds.has(id)) {
        this.pipeRenderer!.dispose(id, this.pipeRoot!);
      }
    }
    for (const pipe of state.pipes) {
      this.pipeRenderer!.getOrCreate(pipe, this.pipeRoot!);
    }
  }

  /**
   * Returns the world-space axis-aligned bounding box of all diagram geometry
   * in the canvas group, or null if the group is not yet initialized or is empty.
   */
  getBoundingBox(): THREE.Box3 | null {
    if (!this.canvasGroup) return null;
    const box = new THREE.Box3().setFromObject(this.canvasGroup);
    if (box.isEmpty()) return null;
    return box;
  }

  dispose(_canvasId: string, scene: THREE.Scene): void {
    if (this.canvasGroup) {
      scene.remove(this.canvasGroup);
    }
    for (const [id, renderer] of this.diagramRenderers) {
      if (this.canvasGroup) renderer.dispose(id, this.canvasGroup);
    }
    this.diagramRenderers.clear();
    this.pipeRenderer?.disposeAll(this.pipeRoot ?? new THREE.Group());
    this.canvasGroup = null;
    this.pipeRoot = null;
  }

  getInteractionMeshes(): ReadonlySet<THREE.Mesh> {
    const all = new Set<THREE.Mesh>();
    for (const dr of this.diagramRenderers.values()) {
      for (const m of dr.interactionRegistry.meshes) all.add(m);
    }
    return all;
  }

  lookupInteraction(mesh: THREE.Mesh): { diagramId: string; nodeId: string } | undefined {
    for (const dr of this.diagramRenderers.values()) {
      const info = dr.interactionRegistry.lookup(mesh);
      if (info) return info;
    }
    return undefined;
  }

  getGroupInteractionMeshes(): ReadonlySet<THREE.Mesh> {
    const all = new Set<THREE.Mesh>();
    for (const dr of this.diagramRenderers.values()) {
      for (const m of dr.groupInteractionRegistry.meshes) all.add(m);
    }
    return all;
  }

  lookupGroupInteraction(mesh: THREE.Mesh): { diagramId: string; groupId: string } | undefined {
    for (const dr of this.diagramRenderers.values()) {
      const info = dr.groupInteractionRegistry.lookup(mesh);
      if (info) return info;
    }
    return undefined;
  }

  setNodeEmissiveOverride(diagramId: string, nodeId: string, enabled: boolean | undefined): void {
    this.diagramRenderers.get(diagramId)?.setNodeEmissiveOverride(diagramId, nodeId, enabled);
  }

  clearNodeEmissiveOverrides(diagramId?: string): void {
    if (diagramId) {
      this.diagramRenderers.get(diagramId)?.clearNodeEmissiveOverrides(diagramId);
      return;
    }
    for (const [id, renderer] of this.diagramRenderers.entries()) {
      renderer.clearNodeEmissiveOverrides(id);
    }
  }
}
