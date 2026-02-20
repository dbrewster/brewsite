import type { Group } from 'three';
import type { Model } from '../../../../robot/runtime/types';
import { ThreeModel } from '../../../../components/robot/runtimeAdapters/ThreeModel';
import { createWorldRootWithModel, ensureRootName } from '../../../../components/robot/runtimeAdapters/threeWorldUtils';

export type ThreeBrainModelResult = {
  model: Group;
  worldRoot: Group;
  adapter: Model;
};

export const createThreeBrainModel = (model: Group): ThreeBrainModelResult => {
  ensureRootName(model, 'BrainRoot');
  const { worldRoot, world } = createWorldRootWithModel(model, 'BrainWorldRoot');
  const adapter = new ThreeModel({ world, rootName: model.name, rootObject: model });
  return { model, worldRoot, adapter };
};
