import {describe, expect, it} from 'vitest';
import {clamp01, composeMatrix, copyVec3, decomposeMatrix, lerp, lerpVec3, multiplyMatrices, quatFromEuler, quatNormalize, quatSlerp, quatToEuler,} from '../math';

const closeVec = (a: number[], b: number[], precision = 5) => {
  a.forEach((value, index) => expect(value).toBeCloseTo(b[index] ?? 0, precision));
};

describe('runtime math', () => {
  it('clamps and lerps values', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(10, 0, 0.25)).toBe(7.5);
    closeVec(lerpVec3([0, 0, 0], [2, 2, 2], 0.25), [0.5, 0.5, 0.5]);
    closeVec(lerpVec3([1, -1, 2], [3, 1, 6], 0.5), [2, 0, 4]);
  });

  it('normalizes quaternions and handles tiny lengths', () => {
    const q = quatNormalize({ x: 0, y: 0, z: 0, w: 0 });
    expect(q.w).toBe(1);
    const q2 = quatNormalize({ x: 1, y: 0, z: 0, w: 0 });
    expect(q2.x).toBeCloseTo(1, 5);
    const q3 = quatNormalize({ x: 2, y: 0, z: 0, w: 0 });
    expect(q3.x).toBeCloseTo(1, 5);
  });

  it('slerps quaternions across edge cases', () => {
    const a = quatFromEuler([0, 0, 0]);
    const b = quatFromEuler([Math.PI, 0, 0]);
    const negB = { x: -b.x, y: -b.y, z: -b.z, w: -b.w };
    const s1 = quatSlerp(a, negB, 0.5);
    const s1Len = Math.hypot(s1.x, s1.y, s1.z, s1.w);
    expect(s1Len).toBeCloseTo(1, 3);

    const s2 = quatSlerp(a, a, 0.5);
    expect(s2.w).toBeCloseTo(1, 5);

    const small = quatSlerp(a, { x: a.x + 1e-6, y: a.y, z: a.z, w: a.w }, 0.5);
    expect(small.w).toBeCloseTo(a.w, 5);

    const sStart = quatSlerp(a, b, 0);
    expect(sStart.w).toBeCloseTo(a.w, 5);
    const sEnd = quatSlerp(a, b, 1);
    expect(sEnd.x).toBeCloseTo(b.x, 5);
  });

  it('composes and decomposes matrices', () => {
    const matrix = composeMatrix([1, 2, 3], [0.1, 0.2, 0.3], [2, 2, 2]);
    const decomposed = decomposeMatrix(matrix);
    closeVec(decomposed.position, [1, 2, 3]);
    closeVec(decomposed.scale, [2, 2, 2]);

    const identity = composeMatrix([0, 0, 0], [0, 0, 0], [1, 1, 1]);
    const multiplied = multiplyMatrices(identity, matrix);
    const decomposed2 = decomposeMatrix(multiplied);
    closeVec(decomposed2.position, [1, 2, 3]);

    const custom: [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number] = [
      2, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 0.5, 0,
      0, 0, 0, 1,
    ];
    const decomposed3 = decomposeMatrix(custom);
    expect(decomposed3.scale[0]).toBeCloseTo(2, 5);
  });

  it('converts quaternions to euler', () => {
    const q = quatFromEuler([0.2, 0.1, -0.3]);
    const e = quatToEuler(q);
    const q2 = quatFromEuler(e);
    const dot = q.x * q2.x + q.y * q2.y + q.z * q2.z + q.w * q2.w;
    expect(Math.abs(dot)).toBeCloseTo(1, 2);
  });

  it('copies vec3 values without mutating the source', () => {
    const source: [number, number, number] = [1, 2, 3];
    const copy = copyVec3(source);
    expect(copy).toEqual(source);
    expect(copy).not.toBe(source);
    copy[0] = 9;
    expect(source[0]).toBe(1);
  });
});
