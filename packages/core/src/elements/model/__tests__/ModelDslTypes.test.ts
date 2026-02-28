import { describe, it, expectTypeOf } from 'vitest';
import type { ModelProps, MotionProps } from '../dsl';
import type { SceneSnapshotContext } from '../../../compiler/sceneTypes';

describe('Model DSL types', () => {
  it('position function prop receives SceneSnapshotContext', () => {
    type PositionFn = Extract<ModelProps['position'], Function>;
    expectTypeOf<Parameters<NonNullable<PositionFn>>[0]>().toEqualTypeOf<SceneSnapshotContext>();
  });

  it('MotionProps commands/scenes/customAnimations are concrete arrays', () => {
    expectTypeOf<NonNullable<MotionProps['commands']>>().not.toBeAny();
    expectTypeOf<NonNullable<MotionProps['scenes']>>().not.toBeAny();
    expectTypeOf<NonNullable<MotionProps['customAnimations']>>().not.toBeAny();
  });
});
