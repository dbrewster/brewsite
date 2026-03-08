import { describe, it, expect } from 'vitest';
import {
  modelTransitionSpec,
  playbackTransitionSpec,
  instanceTransitionSpec,
  compileAnimation,
  resolveClipRangeSeconds,
  applyModelTransform,
  Model,
  Playback,
} from '../index';
import {
  modelTransitionSpec as DIRECT_MODEL_SPEC,
  playbackTransitionSpec as DIRECT_PLAYBACK_SPEC,
  instanceTransitionSpec as DIRECT_INSTANCE_SPEC,
  compileAnimation as DIRECT_COMPILE,
  resolveClipRangeSeconds as DIRECT_RESOLVE,
} from '../compile';
import { applyModelTransform as DIRECT_APPLY } from '../render';
import { Model as DIRECT_MODEL, Playback as DIRECT_PLAYBACK } from '../ModelWidget';

describe('model index re-exports', () => {
  it('re-exports compile helpers', () => {
    expect(modelTransitionSpec).toBe(DIRECT_MODEL_SPEC);
    expect(playbackTransitionSpec).toBe(DIRECT_PLAYBACK_SPEC);
    expect(instanceTransitionSpec).toBe(DIRECT_INSTANCE_SPEC);
    expect(compileAnimation).toBe(DIRECT_COMPILE);
    expect(resolveClipRangeSeconds).toBe(DIRECT_RESOLVE);
  });

  it('re-exports render + DSL components', () => {
    expect(applyModelTransform).toBe(DIRECT_APPLY);
    expect(Model).toBe(DIRECT_MODEL);
    expect(Playback).toBe(DIRECT_PLAYBACK);
  });
});
