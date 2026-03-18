// rotationMath.ts — Quaternion helpers for blendAxisRotation.
//
// Uses ZYX intrinsic (= XYZ extrinsic) Euler angle convention so that
// pitchPct/yawPct/rollPct in blendAxisRotation map correctly to scene-space
// rotations. This convention differs from math/index.ts (which uses a different
// order for composeMatrix/decomposeMatrix). Do NOT merge with math/quatFromEuler.

import { lerp } from '../../math';

/** Quaternion with ZYX intrinsic Euler convention. */
export type Quat = { x: number; y: number; z: number; w: number };

const clampUnit = (value: number): number => Math.max(-1, Math.min(1, value));

export const normalizeQuat = (q: Quat): Quat => {
  const len = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
};

export const eulerToQuaternionXYZ = (x: number, y: number, z: number): Quat => {
  const hx = x * 0.5;
  const hy = y * 0.5;
  const hz = z * 0.5;
  const sx = Math.sin(hx);
  const cx = Math.cos(hx);
  const sy = Math.sin(hy);
  const cy = Math.cos(hy);
  const sz = Math.sin(hz);
  const cz = Math.cos(hz);

  return {
    x: sx * cy * cz - cx * sy * sz,
    y: cx * sy * cz + sx * cy * sz,
    z: cx * cy * sz - sx * sy * cz,
    w: cx * cy * cz + sx * sy * sz,
  };
};

export const quaternionToEulerXYZ = (q: Quat): [number, number, number] => {
  const qq = normalizeQuat(q);
  const sinrCosp = 2 * (qq.w * qq.x + qq.y * qq.z);
  const cosrCosp = 1 - 2 * (qq.x * qq.x + qq.y * qq.y);
  const x = Math.atan2(sinrCosp, cosrCosp);

  const sinp = 2 * (qq.w * qq.y - qq.z * qq.x);
  const y = Math.asin(clampUnit(sinp));

  const sinyCosp = 2 * (qq.w * qq.z + qq.x * qq.y);
  const cosyCosp = 1 - 2 * (qq.y * qq.y + qq.z * qq.z);
  const z = Math.atan2(sinyCosp, cosyCosp);

  return [x, y, z];
};

export const slerpQuat = (from: Quat, to: Quat, t: number): Quat => {
  let cosHalfTheta = from.x * to.x + from.y * to.y + from.z * to.z + from.w * to.w;
  let toQ = to;
  if (cosHalfTheta < 0) {
    cosHalfTheta = -cosHalfTheta;
    toQ = { x: -to.x, y: -to.y, z: -to.z, w: -to.w };
  }

  if (cosHalfTheta > 0.9995) {
    return normalizeQuat({
      x: lerp(from.x, toQ.x, t),
      y: lerp(from.y, toQ.y, t),
      z: lerp(from.z, toQ.z, t),
      w: lerp(from.w, toQ.w, t),
    });
  }

  const halfTheta = Math.acos(cosHalfTheta);
  const sinHalfTheta = Math.sqrt(1 - cosHalfTheta * cosHalfTheta);
  const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
  const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;
  return {
    x: from.x * ratioA + toQ.x * ratioB,
    y: from.y * ratioA + toQ.y * ratioB,
    z: from.z * ratioA + toQ.z * ratioB,
    w: from.w * ratioA + toQ.w * ratioB,
  };
};
