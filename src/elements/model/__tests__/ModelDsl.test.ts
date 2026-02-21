import { describe, it, expect } from 'vitest';
import {
  Model,
  BodyParts,
  BodyPart,
  Pose,
  ModelPart,
  ContainedModel,
  Subpart,
  Playback,
  Motion,
  Animation,
} from '../dsl';

describe('model DSL components', () => {
  it('render null for all DSL components', () => {
    expect(Model({ type: 'robot', id: 'robot-1' })).toBeNull();
    expect(BodyParts({})).toBeNull();
    expect(BodyPart({ id: 'Body' })).toBeNull();
    expect(Pose({})).toBeNull();
    expect(ModelPart({ id: 'part', anchor: 'anchor', position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 })).toBeNull();
    expect(ContainedModel({ modelId: 'brain' })).toBeNull();
    expect(Subpart({ id: 'Cortex' })).toBeNull();
    expect(Playback({})).toBeNull();
    expect(Motion({})).toBeNull();
    expect(Animation({})).toBeNull();
  });
});
