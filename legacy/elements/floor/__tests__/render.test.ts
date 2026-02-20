import { beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal stub mesh that tracks visibility and parent
class StubMesh {
  visible = true;
  rotation = { set: vi.fn() };
  position = { set: vi.fn() };
  removeFromParent = vi.fn();
  // parent tracks which scene it was added to
  parent: unknown = null;
}

vi.mock('three', () => ({
  Mesh: vi.fn().mockImplementation(() => new StubMesh()),
  PlaneGeometry: vi.fn().mockImplementation(() => ({ dispose: vi.fn() })),
  MeshStandardMaterial: vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
    map: null,
    needsUpdate: false,
  })),
  RepeatWrapping: 1,
  TextureLoader: vi.fn().mockImplementation(() => ({ load: vi.fn() })),
}));

import { applyFloor } from '../render';
import type { SceneFloor } from '../types';

const makeScene = () => {
  const children: unknown[] = [];
  return {
    add: vi.fn((obj: unknown) => {
      children.push(obj);
      (obj as { parent: unknown }).parent = children;
    }),
    remove: vi.fn((obj: unknown) => {
      const idx = children.indexOf(obj);
      if (idx >= 0) children.splice(idx, 1);
    }),
    _children: children,
  };
};

describe('applyFloor', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('does not add a mesh when disabled', () => {
    const scene = makeScene();
    applyFloor({ enabled: false }, { scene: scene as unknown as import('three').Scene });
    expect(scene.add).not.toHaveBeenCalled();
  });

  it('hides the mesh rather than removing it when disabled after being enabled', () => {
    const scene = makeScene();
    const refs = { scene: scene as unknown as import('three').Scene };
    // First call: enable — creates and adds mesh
    applyFloor({ enabled: true }, refs);
    expect(scene.add).toHaveBeenCalledTimes(1);
    const mesh = scene._children[0] as StubMesh;
    // Second call: disable — should hide, not remove
    applyFloor({ enabled: false }, refs);
    expect(mesh.visible).toBe(false);
  });

  it('adds a mesh to the scene when enabled', () => {
    const scene = makeScene();
    applyFloor({ enabled: true }, { scene: scene as unknown as import('three').Scene });
    expect(scene.add).toHaveBeenCalledTimes(1);
  });

  it('does not create a second mesh on repeated enabled calls (same scene)', () => {
    const scene = makeScene();
    const refs = { scene: scene as unknown as import('three').Scene };
    applyFloor({ enabled: true }, refs);
    applyFloor({ enabled: true }, refs);
    // add should still only have been called once (mesh was reused)
    expect(scene.add).toHaveBeenCalledTimes(1);
  });

  it('makes mesh visible again when re-enabled after being disabled', () => {
    const scene = makeScene();
    const refs = { scene: scene as unknown as import('three').Scene };
    applyFloor({ enabled: true }, refs);
    const mesh = scene._children[0] as StubMesh;
    applyFloor({ enabled: false }, refs);
    expect(mesh.visible).toBe(false);
    applyFloor({ enabled: true }, refs);
    expect(mesh.visible).toBe(true);
  });

  it('triggers texture load when textureUrl is provided', async () => {
    const { TextureLoader } = await import('three');
    const loadFn = vi.fn();
    (TextureLoader as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({ load: loadFn }));
    const scene = makeScene();
    const state: SceneFloor = { enabled: true, textureUrl: '/assets/floor.png' };
    applyFloor(state, { scene: scene as unknown as import('three').Scene });
    expect(loadFn).toHaveBeenCalledWith(
      '/assets/floor.png',
      expect.any(Function),
      undefined,
      expect.any(Function),
    );
  });

  it('does not re-trigger texture load when textureUrl is unchanged on subsequent call', async () => {
    const { TextureLoader } = await import('three');
    const loadFn = vi.fn();
    (TextureLoader as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({ load: loadFn }));
    const scene = makeScene();
    const refs = { scene: scene as unknown as import('three').Scene };
    const state: SceneFloor = { enabled: true, textureUrl: '/assets/floor.png' };
    applyFloor(state, refs);
    applyFloor(state, refs);
    expect(loadFn).toHaveBeenCalledTimes(1);
  });
});
