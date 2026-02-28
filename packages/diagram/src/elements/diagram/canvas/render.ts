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

  update(state: DiagramCanvasState, scene: THREE.Scene): void {
    if (!this.canvasGroup) {
      this.canvasGroup = new THREE.Group();
      this.canvasGroup.name = `canvas:${state.id}`;
      this.pipeRoot = new THREE.Group();
      this.pipeRoot.name = `canvas:${state.id}:pipes`;
      this.canvasGroup.add(this.pipeRoot);
      scene.add(this.canvasGroup);
      this.pipeRenderer = new EdgeRenderer(new EdgeMaterialFactory());
    }

    this.canvasGroup.position.set(state.position[0], state.position[1], state.position[2]);
    this.canvasGroup.rotation.set(state.rotation[0], state.rotation[1], state.rotation[2]);
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
        this.diagramRenderers.set(diagramState.id, new DiagramRenderer());
      }
      this.diagramRenderers.get(diagramState.id)!.update(diagramState, this.canvasGroup);
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
