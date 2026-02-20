export type Vec3 = [number, number, number];
export type Mat4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const lerpVec3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

export type Quaternion = { x: number; y: number; z: number; w: number };

export const quatFromEuler = (rotation: Vec3): Quaternion => {
  const [x, y, z] = rotation;
  const c1 = Math.cos(x / 2);
  const c2 = Math.cos(y / 2);
  const c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2);
  const s2 = Math.sin(y / 2);
  const s3 = Math.sin(z / 2);

  return {
    x: s1 * c2 * c3 + c1 * s2 * s3,
    y: c1 * s2 * c3 - s1 * c2 * s3,
    z: c1 * c2 * s3 + s1 * s2 * c3,
    w: c1 * c2 * c3 - s1 * s2 * s3,
  };
};

export const quatNormalize = (q: Quaternion): Quaternion => {
  const len = Math.hypot(q.x, q.y, q.z, q.w);
  if (len <= 1e-8) return { x: 0, y: 0, z: 0, w: 1 };
  return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
};

export const quatSlerp = (a: Quaternion, b: Quaternion, t: number): Quaternion => {
  let bx = b.x;
  let by = b.y;
  let bz = b.z;
  let bw = b.w;
  let cosHalfTheta = a.x * bx + a.y * by + a.z * bz + a.w * bw;

  if (cosHalfTheta < 0) {
    cosHalfTheta = -cosHalfTheta;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }

  if (cosHalfTheta >= 1.0) {
    return { x: a.x, y: a.y, z: a.z, w: a.w };
  }

  const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);
  if (sinHalfTheta < 0.001) {
    return quatNormalize({
      x: a.x * (1 - t) + bx * t,
      y: a.y * (1 - t) + by * t,
      z: a.z * (1 - t) + bz * t,
      w: a.w * (1 - t) + bw * t,
    });
  }

  const halfTheta = Math.atan2(sinHalfTheta, cosHalfTheta);
  const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
  const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;
  return {
    x: a.x * ratioA + bx * ratioB,
    y: a.y * ratioA + by * ratioB,
    z: a.z * ratioA + bz * ratioB,
    w: a.w * ratioA + bw * ratioB,
  };
};

export const quatToEuler = (q: Quaternion): Vec3 => {
  const x = q.x;
  const y = q.y;
  const z = q.z;
  const w = q.w;

  const sinrCosp = 2 * (w * x + y * z);
  const cosrCosp = 1 - 2 * (x * x + y * y);
  const roll = Math.atan2(sinrCosp, cosrCosp);

  const sinp = 2 * (w * y - z * x);
  const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * (Math.PI / 2) : Math.asin(sinp);

  const sinyCosp = 2 * (w * z + x * y);
  const cosyCosp = 1 - 2 * (y * y + z * z);
  const yaw = Math.atan2(sinyCosp, cosyCosp);

  return [roll, pitch, yaw];
};

export const composeMatrix = (position: Vec3, rotation: Vec3, scale: Vec3): Mat4 => {
  const q = quatFromEuler(rotation);
  const x = q.x;
  const y = q.y;
  const z = q.z;
  const w = q.w;

  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;

  const sx = scale[0];
  const sy = scale[1];
  const sz = scale[2];

  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    position[0],
    position[1],
    position[2],
    1,
  ];
};

export const multiplyMatrices = (a: Mat4, b: Mat4): Mat4 => {
  const result = Array(16).fill(0) as Mat4;
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 4; j += 1) {
      result[i + j * 4] =
        a[0 + j * 4] * b[i + 0 * 4] +
        a[1 + j * 4] * b[i + 1 * 4] +
        a[2 + j * 4] * b[i + 2 * 4] +
        a[3 + j * 4] * b[i + 3 * 4];
    }
  }
  return result;
};

export const decomposeMatrix = (matrix: Mat4): { position: Vec3; rotation: Vec3; scale: Vec3 } => {
  const px = matrix[12];
  const py = matrix[13];
  const pz = matrix[14];

  const sx = Math.hypot(matrix[0], matrix[1], matrix[2]);
  const sy = Math.hypot(matrix[4], matrix[5], matrix[6]);
  const sz = Math.hypot(matrix[8], matrix[9], matrix[10]);

  const invSx = sx !== 0 ? 1 / sx : 0;
  const invSy = sy !== 0 ? 1 / sy : 0;
  const invSz = sz !== 0 ? 1 / sz : 0;

  const m11 = matrix[0] * invSx;
  const m12 = matrix[1] * invSx;
  const m13 = matrix[2] * invSx;
  const m21 = matrix[4] * invSy;
  const m22 = matrix[5] * invSy;
  const m23 = matrix[6] * invSy;
  const m31 = matrix[8] * invSz;
  const m32 = matrix[9] * invSz;
  const m33 = matrix[10] * invSz;

  const trace = m11 + m22 + m33;
  let q: Quaternion;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1.0);
    q = {
      w: 0.25 / s,
      x: (m32 - m23) * s,
      y: (m13 - m31) * s,
      z: (m21 - m12) * s,
    };
  } else if (m11 > m22 && m11 > m33) {
    const s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33);
    q = {
      w: (m32 - m23) / s,
      x: 0.25 * s,
      y: (m12 + m21) / s,
      z: (m13 + m31) / s,
    };
  } else if (m22 > m33) {
    const s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33);
    q = {
      w: (m13 - m31) / s,
      x: (m12 + m21) / s,
      y: 0.25 * s,
      z: (m23 + m32) / s,
    };
  } else {
    const s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22);
    q = {
      w: (m21 - m12) / s,
      x: (m13 + m31) / s,
      y: (m23 + m32) / s,
      z: 0.25 * s,
    };
  }

  return {
    position: [px, py, pz],
    rotation: quatToEuler(quatNormalize(q)),
    scale: [sx, sy, sz],
  };
};

export const copyVec3 = (value: Vec3): Vec3 => [value[0], value[1], value[2]];
