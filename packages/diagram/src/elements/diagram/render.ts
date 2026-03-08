// Three.js rendering for DiagramState.
// Orchestrates NodeRenderer, EdgeRenderer, GroupRenderer, EnvMapManager.
// Converts NVS [0..1] positions to canvas-local space before dispatching to sub-renderers.

import * as THREE from 'three';
import type { DiagramState, DiagramNodeState, DiagramEdgeState, DiagramGroupState, DiagramGroupEdgeLightsState } from './types';
import type { NVSRect } from '@brewsite/core';
import { NodeRenderer } from './rendering/NodeRenderer';
import { EdgeRenderer } from './rendering/EdgeRenderer';
import { GroupRenderer } from './rendering/GroupRenderer';
import { EdgeMaterialFactory } from './rendering/EdgeMaterialFactory';
import { EnvMapManager } from './rendering/EnvMapManager';
import { InteractionRegistry } from './rendering/InteractionRegistry';
import { sharedIconLoader } from './rendering/IconLoader';
import { GroupInteractionRegistry } from './rendering/GroupInteractionRegistry';
import type { DiagramThemeRenderConfig } from './types';

/**
 * Computes a cache key from the EdgeRenderer construction-time params.
 * Used to detect when EdgeRenderer needs to be recreated between updates.
 */
function edgeThemeKey(tc: DiagramThemeRenderConfig): string {
  return [
    tc.use3DArrows,
    tc.edgeSmoothness,
    tc.edgeMetalness,
    tc.edgeRoughness,
    tc.edgeFlowSpeed,
    tc.edgeFlowWidth,
    tc.edgeFlowPulseIntensity,
  ].join('|');
}

const findScene = (obj: THREE.Object3D): THREE.Scene | null => {
  let current: THREE.Object3D | null = obj;
  while (current) {
    if (current instanceof THREE.Scene) return current;
    current = current.parent;
  }
  return null;
};

/**
 * Converts a node's [0..1] NVS position within a diagram viewport to canvas-local space.
 * Canvas-local convention: center-origin, Y-up, X scaled by canvasAspect.
 */
function nodeNvsToCanvasLocal(
  nvsPos: readonly [number, number, number],
  vp: NVSRect,
  aspect: number,
): readonly [number, number, number] {
  const vpX = vp.x + vp.w * nvsPos[0];
  const vpY = vp.y + vp.h * nvsPos[1];
  const localX = (vpX - 0.5) * aspect;
  const localY = -(vpY - 0.5);  // Y-flip: NVS y=0 top → canvas +Y
  return [localX, localY, nvsPos[2]];
}

/**
 * Converts a node's [0..1] NVS size fractions to canvas-local units.
 */
function nodeSizeToCanvasLocal(
  nvsSize: readonly [number, number],
  vp: NVSRect,
  aspect: number,
): readonly [number, number] {
  return [nvsSize[0] * vp.w * aspect, nvsSize[1] * vp.h];
}

export class DiagramRenderer {
  private diagramGroups = new Map<string, THREE.Group>();
  private lastState = new Map<string, DiagramState>();
  private readonly envMapManager = new EnvMapManager();

  readonly interactionRegistry = new InteractionRegistry();
  readonly groupInteractionRegistry = new GroupInteractionRegistry();

  // Fully initialized in constructor — no null checks needed on update():
  private readonly nodeRenderer: NodeRenderer;
  private edgeRenderer: EdgeRenderer;                // NOT readonly — may be recreated on theme change
  private readonly groupRenderer: GroupRenderer;

  /** Tracks the last edge theme key to detect when EdgeRenderer must be recreated. */
  private lastEdgeThemeKey: string;

  /** Canvas aspect ratio (canvasWidth / canvasHeight in canvas units). Set by DiagramCanvasRenderer before each update(). */
  private _canvasAspect: number = 16 / 9;

  constructor(initialThemeConfig: DiagramThemeRenderConfig) {
    this.nodeRenderer = new NodeRenderer(sharedIconLoader, this.interactionRegistry);
    this.edgeRenderer = new EdgeRenderer(
      new EdgeMaterialFactory(),
      initialThemeConfig.use3DArrows,
      initialThemeConfig.edgeSmoothness,
      initialThemeConfig.edgeMetalness,
      initialThemeConfig.edgeRoughness,
      initialThemeConfig.edgeFlowSpeed,
      initialThemeConfig.edgeFlowWidth,
      initialThemeConfig.edgeFlowPulseIntensity,
    );
    this.groupRenderer = new GroupRenderer(this.groupInteractionRegistry);
    this.lastEdgeThemeKey = edgeThemeKey(initialThemeConfig);
  }

  /**
   * Sets the canvas aspect ratio used for NVS → canvas-local conversion.
   * Must be called by DiagramCanvasRenderer before each call to update().
   */
  setCanvasAspect(aspect: number): void {
    this._canvasAspect = aspect;
  }

  update(state: DiagramState, parent: THREE.Object3D): void {
    const tc = state.themeConfig;

    // Recreate EdgeRenderer if any construction-time edge params changed.
    const newKey = edgeThemeKey(tc);
    if (newKey !== this.lastEdgeThemeKey) {
      const root = this.diagramGroups.get(state.id);
      if (root) this.edgeRenderer.disposeAll(root);
      this.edgeRenderer = new EdgeRenderer(
        new EdgeMaterialFactory(),
        tc.use3DArrows,
        tc.edgeSmoothness,
        tc.edgeMetalness,
        tc.edgeRoughness,
        tc.edgeFlowSpeed,
        tc.edgeFlowWidth,
        tc.edgeFlowPulseIntensity,
      );
      this.lastEdgeThemeKey = newKey;
    }

    const prev = this.lastState.get(state.id);
    if (!this.diagramGroups.has(state.id)) {
      const root = new THREE.Group();
      root.name = `diagram:${state.id}`;
      this.diagramGroups.set(state.id, root);
      parent.add(root);
    }
    const root = this.diagramGroups.get(state.id)!;

    // Position the diagram root at the center of its viewport bounds in canvas-local space.
    const vp = state.viewportBounds;
    const vpCX = vp.x + vp.w / 2;
    const vpCY = vp.y + vp.h / 2;
    const localX = (vpCX - 0.5) * this._canvasAspect;
    const localY = -(vpCY - 0.5);  // Y-flip
    root.position.set(localX, localY, 0);
    root.rotation.set(state.tiltRotation[0], state.tiltRotation[1], state.tiltRotation[2]);
    root.scale.setScalar(1);

    const scene = findScene(parent);
    if (scene) {
      this.envMapManager.apply(scene, tc.envMapUrl, tc.envMapIntensity);
    }

    const activeGroupIds = new Set(state.groups.map((g) => g.id));
    if (prev) {
      for (const g of prev.groups) {
        if (!activeGroupIds.has(g.id)) {
          this.groupRenderer.dispose(g.id, state.id, root);
        }
      }
    }

    // Convert group bounds from [0..1] NVS → canvas-local before passing to GroupRenderer.
    // GroupRenderer.updateGroup() computes: centerX = bounds.x + bounds.w / 2; centerY = bounds.y + bounds.h / 2
    // For this formula to produce the correct canvas-local center, bounds.y must be the canvas-local BOTTOM edge (Y-up).
    for (const groupState of state.groups) {
      const nvsHalfW = groupState.bounds.w / 2;
      const nvsHalfH = groupState.bounds.h / 2;
      const localW = groupState.bounds.w * this._canvasAspect * vp.w;
      const localH = groupState.bounds.h * vp.h;
      const localHalfW = localW / 2;
      const localHalfH = localH / 2;

      // canvas-local left edge: map NVS group left edge → canvas-local X, then subtract diagram root offset
      const localGX = (vp.x + vp.w * groupState.bounds.x - 0.5) * this._canvasAspect - localX;
      // canvas-local BOTTOM edge: NVS top+height → flip → subtract root offset
      const localGY = 0.5 - (vp.y + vp.h * (groupState.bounds.y + groupState.bounds.h)) - localY;

      // Rescale edge lights from NVS-group-local fractions to canvas-local units.
      let convertedEdgeLights: DiagramGroupEdgeLightsState | undefined = groupState.edgeLights;
      if (groupState.edgeLights && nvsHalfW > 0 && nvsHalfH > 0) {
        convertedEdgeLights = {
          ...groupState.edgeLights,
          lights: groupState.edgeLights.lights.map((light) => ({
            ...light,
            position: [
              light.position[0] * (localHalfW / nvsHalfW),
              light.position[1] * (localHalfH / nvsHalfH),
              light.position[2],  // Z (border height offset) stays in canvas world units
            ] as readonly [number, number, number],
          })),
        };
      }

      const convertedGroup: DiagramGroupState = {
        ...groupState,
        bounds: {
          x: localGX,      // canvas-local LEFT edge (relative to diagram root)
          y: localGY,      // canvas-local BOTTOM edge (Y-up) — required by GroupRenderer centerY formula
          w: localW,
          h: localH,
          padding: [
            groupState.bounds.padding[0] * vp.h,                       // top
            groupState.bounds.padding[1] * vp.w * this._canvasAspect,  // right
            groupState.bounds.padding[2] * vp.h,                       // bottom
            groupState.bounds.padding[3] * vp.w * this._canvasAspect,  // left
          ] as readonly [number, number, number, number],
          titleGap: groupState.bounds.titleGap * vp.h,
        },
        edgeLights: convertedEdgeLights,
      };
      this.groupRenderer.getOrCreate(convertedGroup, state.id, root, tc);
    }

    const activeEdgeIds = new Set(state.edges.map((e) => `${state.id}::${e.id}`));
    for (const id of this.edgeRenderer.ids) {
      if (id.startsWith(`${state.id}::`) && !activeEdgeIds.has(id)) {
        this.edgeRenderer.dispose(id, root);
      }
    }

    // Convert edge control points from [0..1] NVS → canvas-local before passing to EdgeRenderer.
    for (const edgeState of state.edges) {
      const convertedEdge: DiagramEdgeState = {
        ...edgeState,
        controlPoints: edgeState.controlPoints.map((cp) => {
          const cl = nodeNvsToCanvasLocal(cp, vp, this._canvasAspect);
          // Subtract the diagram root offset so positions are relative to root
          return [cl[0] - localX, cl[1] - localY, cl[2]] as readonly [number, number, number];
        }),
      };
      this.edgeRenderer.getOrCreate(
        { ...convertedEdge, id: `${state.id}::${convertedEdge.id}` },
        root,
      );
    }

    const activeNodeIds = new Set(state.nodes.map((n) => n.id));
    if (prev) {
      for (const n of prev.nodes) {
        if (!activeNodeIds.has(n.id)) {
          this.nodeRenderer.dispose(n.id, state.id, root);
        }
      }
    }

    // Convert node positions and sizes from [0..1] NVS → canvas-local before passing to NodeRenderer.
    for (const nodeState of state.nodes) {
      const canvasPos = nodeNvsToCanvasLocal(nodeState.position, vp, this._canvasAspect);
      const canvasSize = nodeSizeToCanvasLocal(nodeState.size, vp, this._canvasAspect);

      const convertedNode: DiagramNodeState = {
        ...nodeState,
        // Position relative to diagram root (subtract root offset)
        position: [canvasPos[0] - localX, canvasPos[1] - localY, canvasPos[2]],
        size: canvasSize,
        // thickness stays in canvas world units (unchanged)
      };
      this.nodeRenderer.getOrCreate(convertedNode, state.id, tc, root);
    }

    this.lastState.set(state.id, state);
  }

  setNodeEmissiveOverride(diagramId: string, nodeId: string, enabled: boolean | undefined): void {
    this.nodeRenderer.setNodeEmissiveOverride(diagramId, nodeId, enabled);
  }

  clearNodeEmissiveOverrides(diagramId: string): void {
    this.nodeRenderer.clearEmissiveOverridesForDiagram(diagramId);
  }

  dispose(diagramId: string, parent: THREE.Object3D): void {
    const root = this.diagramGroups.get(diagramId);
    if (root) {
      parent.remove(root);
    }
    this.nodeRenderer.disposeAllForDiagram(diagramId, root ?? new THREE.Group());
    this.groupRenderer.disposeAllForDiagram(diagramId, root ?? new THREE.Group());
    if (root) {
      for (const id of this.edgeRenderer.ids) {
        if (id.startsWith(`${diagramId}::`)) {
          this.edgeRenderer.dispose(id, root);
        }
      }
    }
    this.diagramGroups.delete(diagramId);
    this.lastState.delete(diagramId);
    this.nodeRenderer.clearEmissiveOverridesForDiagram(diagramId);
    this.interactionRegistry.clear();
    this.groupInteractionRegistry.clear();
    this.envMapManager.disposeAll();
    sharedIconLoader.disposeAll();
  }
}
