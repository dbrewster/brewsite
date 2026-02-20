import { MockModel } from '../../../../robot/runtime/mocks/MockModel';
import { MockWorld, MockNode } from '../../../../robot/runtime/mocks/MockWorld';

export const createMockBrainModel = () => {
  const world = new MockWorld('BrainWorld');
  const model = new MockModel('BrainRoot', world);
  if (!world.getNode('Brain_red')) {
    world.addNode(new MockNode('Brain_red'), model.rootName);
  }
  return { world, model };
};
