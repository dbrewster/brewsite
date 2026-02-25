import { describe, it, expect } from 'vitest';
import {
  clamp01,
  lerp,
  lerpVec3,
  quatFromEuler,
  quatNormalize,
  quatSlerp,
  quatToEuler,
  composeMatrix,
  multiplyMatrices,
  decomposeMatrix,
  copyVec3,
} from '../index';

describe('math/index', () => {
  it('clamp01 and lerp behave', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });

  it('lerpVec3 interpolates components', () => {
    expect(lerpVec3([0, 0, 0], [2, 4, 6], 0.5)).toEqual([1, 2, 3]);
  });

  it('quatNormalize handles tiny length', () => {
    const q = quatNormalize({ x: 0, y: 0, z: 0, w: 0 });
    expect(q).toEqual({ x: 0, y: 0, z: 0, w: 1 });
  });

  it('quatSlerp handles inverted and near-identical quaternions', () => {
    const a = quatFromEuler([0, 0, 0]);
    const b = { x: -a.x, y: -a.y, z: -a.z, w: -a.w };
    const mid = quatSlerp(a, b, 0.5);
    expect(mid.w).toBeGreaterThan(0);

    const near = quatSlerp(a, a, 0.5);
    expect(near).toEqual(a);
  });

  it('quatToEuler round-trips basic axes', () => {
    const q = quatFromEuler([Math.PI / 2, 0, 0]);
    const e = quatToEuler(q);
    expect(e[0]).toBeCloseTo(Math.PI / 2, 4);
  });

  it('composeMatrix and decomposeMatrix round-trip basic transforms', () => {
    const m = composeMatrix([1, 2, 3], [0, 0, 0], [2, 2, 2]);
    const decomp = decomposeMatrix(m);
    expect(decomp.position).toEqual([1, 2, 3]);
    expect(decomp.scale).toEqual([2, 2, 2]);
  });

  it('decomposeMatrix covers rotation branches', () => {
    const rx = decomposeMatrix(composeMatrix([0, 0, 0], [Math.PI, 0, 0], [1, 1, 1]));
    const ry = decomposeMatrix(composeMatrix([0, 0, 0], [0, Math.PI, 0], [1, 1, 1]));
    const rz = decomposeMatrix(composeMatrix([0, 0, 0], [0, 0, Math.PI], [1, 1, 1]));
    expect(Math.abs(rx.rotation[0])).toBeGreaterThan(0);
    expect(Math.abs(ry.rotation[1])).toBeGreaterThan(0);
    expect(Math.abs(rz.rotation[2])).toBeGreaterThan(0);
  });

  it('multiplyMatrices combines transforms', () => {
    const a = composeMatrix([1, 0, 0], [0, 0, 0], [1, 1, 1]);
    const b = composeMatrix([0, 2, 0], [0, 0, 0], [1, 1, 1]);
    const combined = multiplyMatrices(a, b);
    const decomp = decomposeMatrix(combined);
    expect(decomp.position[0]).toBeCloseTo(1, 4);
    expect(decomp.position[1]).toBeCloseTo(2, 4);
  });

  it('copyVec3 returns a new array', () => {
    const v: [number, number, number] = [1, 2, 3];
    const copy = copyVec3(v);
    expect(copy).toEqual([1, 2, 3]);
    expect(copy).not.toBe(v);
  });
});
