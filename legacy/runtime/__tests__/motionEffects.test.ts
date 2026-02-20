import {describe, expect, it} from 'vitest';
import type {RestBoneSpec} from '../../../components/logoParticleOptimizedViewer/robotRig';
import {computeBlinkState, computeRestDelta} from '../motionEffects';

describe('motionEffects', () => {
  it('computes rest deltas with intensity and speed', () => {
    const spec: RestBoneSpec = {
      name: 'test',
      rotX: 0.1,
      rotY: 0.2,
      rotZ: 0.3,
      posX: 1,
      posY: 2,
      posZ: 3,
    };
    const delta = computeRestDelta(spec, 0, 1, 1);
    expect(delta.rotX).toBeCloseTo(0, 6);
    expect(delta.rotY).toBeCloseTo(0.2, 6);
    expect(delta.rotZ).toBeCloseTo(0.3, 6);
    expect(delta.posX).toBeCloseTo(1, 6);
    expect(delta.posY).toBeCloseTo(0, 6);
    expect(delta.posZ).toBeCloseTo(3, 6);
  });

  it('computes blink scale and offset factors', () => {
    const blink = computeBlinkState(0);
    expect(blink.scaleY).toBeLessThan(1);
    expect(blink.yOffsetFactor).toBeGreaterThan(0);
  });
});
