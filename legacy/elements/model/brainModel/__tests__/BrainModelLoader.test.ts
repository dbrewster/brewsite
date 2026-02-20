import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Group } from 'three';
import { loadBrainModel } from '../BrainModelLoader';

type GltfLike = { scene: Group };

const loadSpy = vi.fn((url: string, onLoad: (gltf: GltfLike) => void) => {
  onLoad({ scene: new Group() });
});

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => {
  class GLTFLoader {
    load = loadSpy;
  }
  return { GLTFLoader };
});

describe('BrainModelLoader', () => {
  beforeEach(() => {
    loadSpy.mockReset();
  });

  it('loads a brain model and builds a three adapter', async () => {
    const model = new Group();
    loadSpy.mockImplementation((_url, onLoad) => {
      onLoad({ scene: model });
    });

    const result = await loadBrainModel('/assets/brain_separated.glb');

    expect(loadSpy).toHaveBeenCalled();
    const [calledUrl] = loadSpy.mock.calls[0] ?? [];
    expect(calledUrl).toBe('/assets/brain_separated.glb');
    expect(result.model).toBe(model);
    expect(result.model.name).toBe('BrainRoot');
    expect(result.worldRoot.name).toBe('BrainWorldRoot');
    expect(result.adapter.rootName).toBe('BrainRoot');
    expect(result.adapter.getRoot().name).toBe('BrainRoot');
  });
});
