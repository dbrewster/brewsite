// Three.js rendering for DiagramState.
// Orchestrates NodeRenderer, EdgeRenderer, GroupRenderer, EnvMapManager.

import * as THREE from 'three';
import type { DiagramState, DiagramGroupState, DiagramNodeState } from './types';
import { NodeRenderer } from './rendering/NodeRenderer';
import { EdgeRenderer } from './rendering/EdgeRenderer';
import { GroupRenderer } from './rendering/GroupRenderer';
import { EdgeMaterialFactory } from './rendering/EdgeMaterialFactory';
import { EnvMapManager } from './rendering/EnvMapManager';
import { InteractionRegistry } from './rendering/InteractionRegistry';
import { sharedIconLoader } from './rendering/IconLoader';
import { GroupInteractionRegistry } from './rendering/GroupInteractionRegistry';

const findScene = (obj: THREE.Object3D): THREE.Scene | null => {
  let current: THREE.Object3D | null = obj;
  while (current) {
    if (current instanceof THREE.Scene) return current;
    current = current.parent;
  }
  return null;
};

export class DiagramRenderer {
  private diagramGroups = new Map<string, THREE.Group>();
  private lastState = new Map<string, DiagramState>();
  private readonly envMapManager = new EnvMapManager();

  readonly interactionRegistry = new InteractionRegistry();
  readonly groupInteractionRegistry = new GroupInteractionRegistry();
  private nodeRenderer: NodeRenderer | null = null;
  private edgeRenderer: EdgeRenderer | null = null;
  private groupRenderer: GroupRenderer | null = null;

  update(state: DiagramState, parent: THREE.Object3D): void {
    const tc = state.themeConfig;
    if (!this.nodeRenderer) {
      this.nodeRenderer = new NodeRenderer(sharedIconLoader, this.interactionRegistry);
      this.edgeRenderer = new EdgeRenderer(
        new EdgeMaterialFactory(),
        tc.use3DArrows,
        tc.edgeSmoothness,
        tc.edgeMetalness,
        tc.edgeRoughness,
        tc.edgeFlowSpeed,
        tc.edgeFlowWidth,
      );
      this.groupRenderer = new GroupRenderer(this.groupInteractionRegistry);
    }

    const prev = this.lastState.get(state.id);
    if (!this.diagramGroups.has(state.id)) {
      const root = new THREE.Group();
      root.name = `diagram:${state.id}`;
      this.diagramGroups.set(state.id, root);
      parent.add(root);
    }
    const root = this.diagramGroups.get(state.id)!;
    root.position.set(state.position[0], state.position[1], state.position[2]);
    root.rotation.set(state.rotation[0], state.rotation[1], state.rotation[2]);
    root.scale.setScalar(state.scale);

    const scene = findScene(parent);
    if (scene) {
      this.envMapManager.apply(scene, tc.envMapUrl, tc.envMapIntensity);
    }

    const activeGroupIds = new Set(state.groups.map((g) => g.id));
    if (prev) {
      for (const g of prev.groups) {
        if (!activeGroupIds.has(g.id)) {
          this.groupRenderer!.dispose(g.id, state.id, root);
        }
      }
    }
    const groupBoundsOverride = computeGroupBoundsFromNodes(state.groups, state.nodes);
    for (const groupState of state.groups) {
      const bounds = groupBoundsOverride.get(groupState.id);
      const nextState = bounds ? { ...groupState, bounds } : groupState;
      this.groupRenderer!.getOrCreate(nextState, state.id, root);
    }

    const activeEdgeIds = new Set(state.edges.map((e) => `${state.id}::${e.id}`));
    for (const id of this.edgeRenderer!.ids) {
      if (id.startsWith(`${state.id}::`) && !activeEdgeIds.has(id)) {
        this.edgeRenderer!.dispose(id, root);
      }
    }
    for (const edgeState of state.edges) {
      this.edgeRenderer!.getOrCreate({
        ...edgeState,
        id: `${state.id}::${edgeState.id}`,
      }, root);
    }

    const activeNodeIds = new Set(state.nodes.map((n) => n.id));
    if (prev) {
      for (const n of prev.nodes) {
        if (!activeNodeIds.has(n.id)) {
          this.nodeRenderer!.dispose(n.id, state.id, root);
        }
      }
    }
    for (const nodeState of state.nodes) {
      this.nodeRenderer!.getOrCreate(nodeState, state.id, tc, root);
    }

    this.lastState.set(state.id, state);
  }

  dispose(diagramId: string, parent: THREE.Object3D): void {
    const root = this.diagramGroups.get(diagramId);
    if (root) {
      parent.remove(root);
    }
    this.nodeRenderer?.disposeAllForDiagram(diagramId, root ?? new THREE.Group());
    this.groupRenderer?.disposeAllForDiagram(diagramId, root ?? new THREE.Group());
    if (this.edgeRenderer && root) {
      for (const id of this.edgeRenderer.ids) {
        if (id.startsWith(`${diagramId}::`)) {
          this.edgeRenderer.dispose(id, root);
        }
      }
    }
    this.diagramGroups.delete(diagramId);
    this.lastState.delete(diagramId);
    this.interactionRegistry.clear();
    this.groupInteractionRegistry.clear();
    this.envMapManager.disposeAll();
    sharedIconLoader.disposeAll();
  }
}

const computeGroupBoundsFromNodes = (
  groups: ReadonlyArray<DiagramGroupState>,
  nodes: ReadonlyArray<DiagramNodeState>,
): Map<string, DiagramGroupState['bounds']> => {
  const parentByGroup = new Map<string, string | undefined>();
  const boundsByGroup = new Map<string, DiagramGroupState['bounds']>();
  groups.forEach((g) => parentByGroup.set(g.id, g.parentId));

  const accum = new Map<string, { minX: number; maxX: number; minY: number; maxY: number }>();
  const addToGroup = (groupId: string, x: number, y: number, w: number, h: number): void => {
    const minX = x - w / 2;
    const maxX = x + w / 2;
    const minY = y - h / 2;
    const maxY = y + h / 2;
    const current = accum.get(groupId);
    if (!current) {
      accum.set(groupId, { minX, maxX, minY, maxY });
      return;
    }
    current.minX = Math.min(current.minX, minX);
    current.maxX = Math.max(current.maxX, maxX);
    current.minY = Math.min(current.minY, minY);
    current.maxY = Math.max(current.maxY, maxY);
  };

  nodes.forEach((node) => {
    let groupId = node.groupId;
    if (!groupId) return;
    let current: string | undefined = groupId;
    while (current) {
      addToGroup(current, node.position[0], node.position[1], node.size[0], node.size[1]);
      current = parentByGroup.get(current);
    }
  });

  groups.forEach((group) => {
    const bounds = accum.get(group.id);
    if (!bounds) return;
    const padding = group.bounds.padding ?? 0;
    const w = Math.max(0, bounds.maxX - bounds.minX);
    const h = Math.max(0, bounds.maxY - bounds.minY);
    boundsByGroup.set(group.id, {
      x: bounds.minX - padding,
      y: bounds.minY - padding,
      w: w + padding * 2,
      h: h + padding * 2,
      padding,
    });
  });

  return boundsByGroup;
};
