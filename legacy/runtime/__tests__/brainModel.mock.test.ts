import {describe, expect, it} from 'vitest';
import {createMockBrainModel} from '../../elements/model/brainModel/MockBrainModel';

describe('MockBrainModel', () => {
  it('creates a brain model with expected root and node', () => {
    const { world, model } = createMockBrainModel();
    expect(world.getNode('BrainRoot')).toBeTruthy();
    expect(model.getObject('Brain_red')).toBeTruthy();
  });
});
