// Three.js rendering for DiagramCanvasState.
// WebGL only — no React.
// Owns child DiagramRenderer instances and pipe tube meshes.

import * as THREE from 'three';
import type { DiagramCanvasState, DiagramPipeState } from './types';
import { DiagramRenderer } from '../render';

// Pipe entry mirrors EdgeEntry from diagram/render.ts
type PipeEntry = {
  group: THREE.Group;
  tube: THREE.Mesh;
  arrowStart?: THREE.Mesh;
  arrowEnd?: THREE.Mesh;
  lastState?: DiagramPipeState;
};

export class DiagramCanvasRenderer {
  private canvasGroup: THREE.Group | null = null;
  private pipeRoot: THREE.Group | null = null;
  /** One DiagramRenderer per child diagram, keyed by diagram id. */
  private diagramRenderers = new Map<string, DiagramRenderer>();
  private pipeEntries = new Map<string, PipeEntry>();

  /**
   * Main update path. Creates the canvas root Group on first call,
   * applies the canvas world transform, then delegates each child diagram to
   * a dedicated DiagramRenderer that targets the canvas root as its parent.
   * Pipes are rendered as tube meshes in the canvas root group.
   */
  update(state: DiagramCanvasState, scene: THREE.Scene): void {
    if (!this.canvasGroup) {
      this.canvasGroup = new THREE.Group();
      this.canvasGroup.name = `canvas:${state.id}`;
      this.pipeRoot = new THREE.Group();
      this.pipeRoot.name = `canvas:${state.id}:pipes`;
      this.canvasGroup.add(this.pipeRoot);
      scene.add(this.canvasGroup);
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
    for (const [id, entry] of this.pipeEntries) {
      if (!activePipeIds.has(id)) {
        this.pipeRoot!.remove(entry.group);
        this.disposePipe(entry);
        this.pipeEntries.delete(id);
      }
    }
    for (const pipeState of state.pipes) {
      const entry = this.pipeEntries.get(pipeState.id);
      const updated = entry ?? this.createPipe(pipeState);
      this.updatePipe(updated, pipeState);
      if (!entry) {
        this.pipeEntries.set(pipeState.id, updated);
        this.pipeRoot!.add(updated.group);
      }
    }
  }

  dispose(canvasId: string, scene: THREE.Scene): void {
    if (this.canvasGroup) {
      scene.remove(this.canvasGroup);
    }
    for (const [id, renderer] of this.diagramRenderers) {
      if (this.canvasGroup) renderer.dispose(id, this.canvasGroup);
    }
    this.diagramRenderers.clear();
    for (const entry of this.pipeEntries.values()) {
      this.disposePipe(entry);
    }
    this.pipeEntries.clear();
    this.canvasGroup = null;
    this.pipeRoot = null;
  }

  // ─── Pipe rendering (mirrors edge rendering in diagram/render.ts) ─────────

  private createPipe(state: DiagramPipeState): PipeEntry {
    const group = new THREE.Group();
    const points = state.controlPoints.length >= 2
      ? state.controlPoints.map((pt) => new THREE.Vector3(pt[0], pt[1], pt[2]))
      : [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)];
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(
      curve,
      Math.max(20, state.controlPoints.length * 8),
      state.thickness,
      8,
      false,
    );
    const material = new THREE.MeshStandardMaterial({
      color: state.color,
      metalness: 0.3,
      roughness: 0.7,
      transparent: state.opacity < 1,
      opacity: state.opacity,
    });
    const tube = new THREE.Mesh(geometry, material);
    group.add(tube);
    return { group, tube, lastState: state };
  }

  private updatePipe(entry: PipeEntry, state: DiagramPipeState): void {
    if (state.controlPoints.length < 2) {
      entry.group.visible = false;
      entry.lastState = state;
      return;
    }
    entry.group.visible = true;

    const prev = entry.lastState;
    const needsGeometry =
      !prev ||
      state.controlPoints !== prev.controlPoints ||
      state.thickness !== prev.thickness;

    let curve: THREE.CatmullRomCurve3 | undefined;
    const getCurve = (): THREE.CatmullRomCurve3 => {
      if (!curve) {
        curve = new THREE.CatmullRomCurve3(
          state.controlPoints.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
        );
      }
      return curve;
    };

    if (needsGeometry) {
      const c = getCurve();
      const geometry = new THREE.TubeGeometry(
        c, Math.max(20, state.controlPoints.length * 8), state.thickness, 8, false,
      );
      entry.tube.geometry.dispose();
      entry.tube.geometry = geometry;
    }

    const matChanged =
      !prev ||
      prev.color !== state.color ||
      prev.opacity !== state.opacity ||
      prev.thickness !== state.thickness;
    if (matChanged) {
      const oldMat = entry.tube.material as THREE.Material;
      oldMat.dispose();
      entry.tube.material = new THREE.MeshStandardMaterial({
        color: state.color,
        metalness: 0.3,
        roughness: 0.7,
        transparent: state.opacity < 1,
        opacity: state.opacity,
      });
    }

    entry.lastState = state;
  }

  private disposePipe(entry: PipeEntry): void {
    entry.tube.geometry.dispose();
    (entry.tube.material as THREE.Material).dispose();
  }
}
