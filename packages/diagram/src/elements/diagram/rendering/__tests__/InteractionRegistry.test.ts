import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { InteractionRegistry } from '../InteractionRegistry';

describe('InteractionRegistry', () => {
  it('register and lookup returns correct info', () => {
    const reg = new InteractionRegistry();
    const mesh = new THREE.Mesh();
    reg.register(mesh, 'd1', 'n1');
    expect(reg.lookup(mesh)).toEqual({ diagramId: 'd1', nodeId: 'n1' });
  });

  it('unregister removes from meshes and map', () => {
    const reg = new InteractionRegistry();
    const mesh = new THREE.Mesh();
    reg.register(mesh, 'd1', 'n1');
    reg.unregister(mesh);
    expect(reg.lookup(mesh)).toBeUndefined();
    expect(reg.meshes.has(mesh)).toBe(false);
  });

  it('clear empties both collections', () => {
    const reg = new InteractionRegistry();
    const mesh = new THREE.Mesh();
    reg.register(mesh, 'd1', 'n1');
    reg.clear();
    expect(reg.meshes.size).toBe(0);
  });

  it('registering same mesh twice: second wins', () => {
    const reg = new InteractionRegistry();
    const mesh = new THREE.Mesh();
    reg.register(mesh, 'd1', 'n1');
    reg.register(mesh, 'd2', 'n2');
    expect(reg.lookup(mesh)).toEqual({ diagramId: 'd2', nodeId: 'n2' });
  });

  it('meshes ReadonlySet reflects current state', () => {
    const reg = new InteractionRegistry();
    const mesh1 = new THREE.Mesh();
    const mesh2 = new THREE.Mesh();
    reg.register(mesh1, 'd1', 'n1');
    reg.register(mesh2, 'd2', 'n2');
    expect(reg.meshes.size).toBe(2);
  });
});
