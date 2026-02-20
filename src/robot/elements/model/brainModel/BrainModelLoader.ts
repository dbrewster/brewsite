import type { Group } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Model } from '../../../../robot/runtime/types';
import { createThreeBrainModel } from './ThreeBrainModel';

export type BrainModelLoadResult = {
  model: Group;
  worldRoot: Group;
  adapter: Model;
};

const loadGltf = (url: string): Promise<Group> =>
  new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => resolve(gltf.scene),
      undefined,
      (error) => reject(error),
    );
  });

export const loadBrainModel = async (url: string): Promise<BrainModelLoadResult> => {
  const model = await loadGltf(url);
  if (typeof window !== 'undefined') {
    let meshCount = 0;
    model.traverse((obj) => {
      if ('isMesh' in obj && (obj as { isMesh?: boolean }).isMesh) meshCount += 1;
    });
  }
  const { worldRoot, adapter } = createThreeBrainModel(model);
  return { model, worldRoot, adapter };
};
