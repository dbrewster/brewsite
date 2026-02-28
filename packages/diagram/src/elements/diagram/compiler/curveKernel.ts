// Shared curved-path kernel for endpoint-normal-constrained routes.
// Pure math helpers only — no Three.js, no React.

export type Vec3 = readonly [number, number, number];

export type EndpointCurveOptions = {
  epsilon?: number;
  handleMin?: number;
  handleMax?: number;
  handleFactor?: number;
  allowDirectSegment?: boolean;
  directDistanceThreshold?: number;
  directAlignmentThreshold?: number;
  startPreferSide?: boolean;
  endPreferSide?: boolean;
  sideVerticalRatioThreshold?: number;
  sideVerticalBase?: number;
  sideVerticalFactor?: number;
  sideVerticalMax?: number;
  minSideHandle?: number;
  antiParallelDotThreshold?: number;
  antiParallelHandleBoost?: number;
};

const addVec = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scaleVec = (v: Vec3, scalar: number): Vec3 => [v[0] * scalar, v[1] * scalar, v[2] * scalar];
const dotVec = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lengthVec = (v: Vec3): number => Math.sqrt(dotVec(v, v));
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const normalize = (v: Vec3, fallback: Vec3): Vec3 => {
  const len = lengthVec(v);
  if (len <= 1e-6) return fallback;
  return [v[0] / len, v[1] / len, v[2] / len];
};

export function routeCurvedWithEndpointNormals(
  startAnchor: Vec3,
  endAnchor: Vec3,
  startNormalRaw: Vec3,
  endNormalRaw: Vec3,
  options: EndpointCurveOptions = {},
): ReadonlyArray<Vec3> {
  const epsilon = options.epsilon ?? 0;
  const handleMin = options.handleMin ?? 0.35;
  const handleMax = options.handleMax ?? 4;
  const handleFactor = options.handleFactor ?? 0.28;
  const allowDirectSegment = options.allowDirectSegment ?? false;
  const directDistanceThreshold = options.directDistanceThreshold ?? 0.6;
  const directAlignmentThreshold = options.directAlignmentThreshold ?? 0.97;
  const startPreferSide = options.startPreferSide ?? false;
  const endPreferSide = options.endPreferSide ?? false;
  const sideVerticalRatioThreshold = options.sideVerticalRatioThreshold ?? 0.3;
  const sideVerticalBase = options.sideVerticalBase ?? 0.45;
  const sideVerticalFactor = options.sideVerticalFactor ?? 0.18;
  const sideVerticalMax = options.sideVerticalMax ?? 3.2;
  const minSideHandle = options.minSideHandle ?? 0;
  const antiParallelDotThreshold = options.antiParallelDotThreshold ?? -0.3;
  const antiParallelHandleBoost = options.antiParallelHandleBoost ?? 1;

  const startNormal = normalize(startNormalRaw, [1, 0, 0]);
  const endNormal = normalize(endNormalRaw, [-1, 0, 0]);

  const start = addVec(startAnchor, scaleVec(startNormal, epsilon));
  const end = addVec(endAnchor, scaleVec(endNormal, epsilon));
  const delta: Vec3 = [end[0] - start[0], end[1] - start[1], end[2] - start[2]];
  const dist = lengthVec(delta);
  if (dist <= 1e-6) return [start, end];

  const dir: Vec3 = [delta[0] / dist, delta[1] / dist, delta[2] / dist];
  const startAlign = dotVec(startNormal, dir);
  const endAlign = dotVec(endNormal, [-dir[0], -dir[1], -dir[2]]);
  if (
    allowDirectSegment &&
    dist < directDistanceThreshold &&
    startAlign > directAlignmentThreshold &&
    endAlign > directAlignmentThreshold
  ) {
    return [start, end];
  }

  const baseHandle = clamp(dist * handleFactor, handleMin, handleMax);
  let startHandle = baseHandle;
  let endHandle = baseHandle;
  const verticalDelta = Math.abs(delta[1]);
  const horizontalDelta = Math.abs(delta[0]);

  if (startPreferSide && verticalDelta > horizontalDelta * sideVerticalRatioThreshold) {
    startHandle = Math.max(startHandle, Math.min(sideVerticalMax, sideVerticalBase + verticalDelta * sideVerticalFactor));
  }
  if (endPreferSide && verticalDelta > horizontalDelta * sideVerticalRatioThreshold) {
    endHandle = Math.max(endHandle, Math.min(sideVerticalMax, sideVerticalBase + verticalDelta * sideVerticalFactor));
  }
  if (startPreferSide && minSideHandle > 0) {
    startHandle = Math.max(startHandle, minSideHandle);
  }
  if (endPreferSide && minSideHandle > 0) {
    endHandle = Math.max(endHandle, minSideHandle);
  }

  const dotNormals = dotVec(startNormal, endNormal);
  if (dotNormals < antiParallelDotThreshold && antiParallelHandleBoost > 1) {
    startHandle = clamp(startHandle * antiParallelHandleBoost, handleMin, handleMax);
    endHandle = clamp(endHandle * antiParallelHandleBoost, handleMin, handleMax);
  }

  const c1 = addVec(start, scaleVec(startNormal, startHandle));
  const c2 = addVec(end, scaleVec(endNormal, endHandle));
  return [start, c1, c2, end];
}
