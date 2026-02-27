// Instance-scoped interaction registry for clickable diagram nodes.

import type * as THREE from 'three';

export interface IInteractionRegistry {
  register(mesh: THREE.Mesh, diagramId: string, nodeId: string): void;
  unregister(mesh: THREE.Mesh): void;
  lookup(mesh: THREE.Mesh): { diagramId: string; nodeId: string } | undefined;
  readonly meshes: ReadonlySet<THREE.Mesh>;
  clear(): void;
}

export class InteractionRegistry implements IInteractionRegistry {
  private readonly _meshes = new Set<THREE.Mesh>();
  private readonly _map = new Map<THREE.Mesh, { diagramId: string; nodeId: string }>();

  register(mesh: THREE.Mesh, diagramId: string, nodeId: string): void {
    this._meshes.add(mesh);
    this._map.set(mesh, { diagramId, nodeId });
  }

  unregister(mesh: THREE.Mesh): void {
    this._meshes.delete(mesh);
    this._map.delete(mesh);
  }

  lookup(mesh: THREE.Mesh): { diagramId: string; nodeId: string } | undefined {
    return this._map.get(mesh);
  }

  get meshes(): ReadonlySet<THREE.Mesh> {
    return this._meshes;
  }

  clear(): void {
    this._meshes.clear();
    this._map.clear();
  }
}
