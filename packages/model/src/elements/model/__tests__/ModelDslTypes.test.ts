import { describe, it, expectTypeOf } from 'vitest';
import type { ModelProps, MotionProps } from '../dsl';
import type { SceneSnapshotContext } from '@brewsite/core';

describe('Model DSL types', () => {
  it('x function prop receives SceneSnapshotContext', () => {
    type XFn = Extract<ModelProps['x'], Function>;
    expectTypeOf<Parameters<NonNullable<XFn>>[0]>().toEqualTypeOf<SceneSnapshotContext>();
  });

  it('MotionProps commands/scenes/customAnimations are concrete arrays', () => {
    expectTypeOf<NonNullable<MotionProps['commands']>>().not.toBeAny();
    expectTypeOf<NonNullable<MotionProps['scenes']>>().not.toBeAny();
    expectTypeOf<NonNullable<MotionProps['customAnimations']>>().not.toBeAny();
  });
});
