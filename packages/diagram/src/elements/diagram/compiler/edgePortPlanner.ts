// Per-candidate port anchor assignment for the edge routing pipeline.

import type {
  EdgeFaceCandidate,
  EdgePortCandidate,
  EdgePortPairCandidate,
  EdgeRoutingRequest,
  FaceId,
  RoutingNodeMap,
  Vec3,
} from './routingTypes';

const MIN_PORT_PITCH = 0.05;
const PORT_SPACING_FACTOR = 3.0;
const PORT_MARGIN_FACTOR = 1.5;
const DEFAULT_MAX_PORT_OPTIONS_PER_FACE = 8;
const HARD_MAX_PORT_OPTIONS_PER_FACE = 12;
const MAX_PORT_PAIR_CANDIDATES_PER_FACE_PAIR = 24;

type PortOption = {
  readonly index: number;
  readonly count: number;
  readonly anchor: Vec3;
  readonly localScore: number;
  readonly lateralClass: 'center' | 'inner' | 'outer' | 'edge';
};

const getFaceNormalLocal = (face: FaceId): Vec3 => {
  switch (face) {
    case 'left':   return [-1, 0, 0];
    case 'right':  return [1, 0, 0];
    case 'top':    return [0, 1, 0];
    case 'bottom': return [0, -1, 0];
    case 'front':  return [0, 0, 1];
    case 'back':   return [0, 0, -1];
  }
};

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

const computePortCount = (span: number, thickness: number): number => {
  const pitch = Math.max(MIN_PORT_PITCH, thickness * PORT_SPACING_FACTOR);
  const margin = thickness * PORT_MARGIN_FACTOR;
  const available = Math.max(0, span - margin * 2);
  return Math.max(1, Math.floor(available / pitch));
};

const oddifyPortCount = (count: number): number =>
  count % 2 === 0 ? count + 1 : count;

const resolvePortCountForFace = (
  face: FaceId,
  size: readonly [number, number, number],
  thickness: number,
): number => {
  const [w, h] = size;
  if (face === 'front' || face === 'back') {
    const pitch = Math.max(MIN_PORT_PITCH, thickness * PORT_SPACING_FACTOR);
    return w >= pitch * 2 ? 2 : 1;
  }
  if (face === 'top' || face === 'bottom') return oddifyPortCount(computePortCount(w, thickness));
  if (face === 'left' || face === 'right') return oddifyPortCount(computePortCount(h, thickness));
  return 1;
};

const resolvePortOffset = (index: number, count: number, span: number): number => {
  if (count <= 1) return 0;
  const step = span / (count - 1);
  return -span / 2 + step * index;
};

const dotVec = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const normalizeVec = (v: Vec3): Vec3 => {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (len <= 1e-9) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
};

function getFacePortAnchorLocal(
  pos: Vec3,
  size: readonly [number, number, number],
  face: FaceId,
  portIndex: number,
  portCount: number,
  targetPos: Vec3,
): Vec3 | undefined {
  const [x, y, z] = pos;
  const [w, h, d] = size;
  const dx = targetPos[0] - x;
  const dy = targetPos[1] - y;
  const dz = targetPos[2] - z;
  const useVerticalOffset = Math.abs(dy) > Math.abs(dz) * 0.5;
  const useHorizontalOffset = Math.abs(dx) > Math.abs(dz) * 0.5;
  const yOffset = useVerticalOffset ? (dy > 0 ? h / 2 : -h / 2) : 0;

  switch (face) {
    case 'front':
      return portCount === 1
        ? [x, y + yOffset, z + d / 2]
        : [x + (useHorizontalOffset ? (portIndex === 0 ? -1 : 1) * w / 2 : 0), y + yOffset, z + d / 2];
    case 'back':
      return portCount === 1
        ? [x, y + yOffset, z - d / 2]
        : [x + (useHorizontalOffset ? (portIndex === 0 ? -1 : 1) * w / 2 : 0), y + yOffset, z - d / 2];
    case 'top':
      return [x + resolvePortOffset(portIndex, portCount, w), y + h / 2, z];
    case 'bottom':
      return [x + resolvePortOffset(portIndex, portCount, w), y - h / 2, z];
    case 'left':
      return [x - w / 2, y + resolvePortOffset(portIndex, portCount, h), z];
    case 'right':
      return [x + w / 2, y + resolvePortOffset(portIndex, portCount, h), z];
  }
}

const getLateralClass = (index: number, count: number): PortOption['lateralClass'] => {
  if (count <= 1) return 'center';
  if (index === 0 || index === count - 1) return 'edge';
  const center = (count - 1) / 2;
  const normalized = Math.abs(index - center) / Math.max(center, 1);
  if (normalized < 0.2) return 'center';
  if (normalized < 0.6) return 'inner';
  return 'outer';
};

const pushUniqueIndex = (
  target: number[],
  index: number,
  count: number,
): void => {
  const bounded = clamp(index, 0, count - 1);
  if (!target.includes(bounded)) target.push(bounded);
};

export function buildPortOptions(
  pos: Vec3,
  size: readonly [number, number, number],
  face: FaceId,
  targetPos: Vec3,
  thickness: number,
  isFrom: boolean,
  isLockedFace: boolean,
  isSourceFaceLocked: boolean,
  preferOuterLateral = false,
): ReadonlyArray<PortOption> {
  const portCount = preferOuterLateral && face !== 'front' && face !== 'back'
    ? Math.max(3, resolvePortCountForFace(face, size, thickness))
    : resolvePortCountForFace(face, size, thickness);
  const centerIdx = Math.floor(portCount / 2);
  const faceNormal = getFaceNormalLocal(face);
  const applyLateralBias = !isFrom || isLockedFace;
  const antiLateral = (!isFrom && isSourceFaceLocked) || preferOuterLateral;
  let lateralIdealIdx = centerIdx;

  if (applyLateralBias) {
    const lateralAxis = (face === 'top' || face === 'bottom') ? 0 : 1;
    const faceSpan = (face === 'top' || face === 'bottom') ? size[0] : size[1];
    const halfSpan = Math.max(0.001, faceSpan * 0.5);
    const rawRatio = clamp((targetPos[lateralAxis] - pos[lateralAxis]) / halfSpan, -1, 1);
    const softenedRatio =
      isFrom && (face === 'left' || face === 'right')
        ? rawRatio * 0.6
        : rawRatio;
    const lateralRatio = antiLateral ? -softenedRatio : softenedRatio;
    lateralIdealIdx = clamp(Math.round((lateralRatio + 1) / 2 * (portCount - 1)), 0, portCount - 1);
  }

  const allOptions: PortOption[] = [];
  for (let idx = 0; idx < portCount; idx += 1) {
    const anchor = getFacePortAnchorLocal(pos, size, face, idx, portCount, targetPos);
    if (!anchor) continue;

    const toTarget: Vec3 = normalizeVec([
      targetPos[0] - anchor[0],
      targetPos[1] - anchor[1],
      targetPos[2] - anchor[2],
    ]);
    const routeVec = isFrom ? toTarget : normalizeVec([
      anchor[0] - targetPos[0],
      anchor[1] - targetPos[1],
      anchor[2] - targetPos[2],
    ]);
    const alignment = Math.max(0, dotVec(routeVec, faceNormal));
    const turnPenalty = (1 - alignment) * 300;
    const maxDist = Math.max(centerIdx, 1);
    const normDist = Math.abs(idx - centerIdx) / maxDist;
    const edgePenalty = Math.pow(normDist, 8) * 600;
    const centerBias = Math.abs(idx - centerIdx) * 2;
    const lateralBias = applyLateralBias ? Math.abs(idx - lateralIdealIdx) * 80 : 0;

    allOptions.push({
      index: idx,
      count: portCount,
      anchor,
      localScore: turnPenalty + edgePenalty + centerBias + lateralBias,
      lateralClass: getLateralClass(idx, portCount),
    });
  }

  const ranked = [...allOptions].sort((a, b) => {
    const scoreDelta = a.localScore - b.localScore;
    if (Math.abs(scoreDelta) > 1e-9) return scoreDelta;
    return Math.abs(a.index - centerIdx) - Math.abs(b.index - centerIdx);
  });

  const desiredIndices: number[] = [];
  ranked.slice(0, 3).forEach((option) => pushUniqueIndex(desiredIndices, option.index, portCount));
  pushUniqueIndex(desiredIndices, centerIdx, portCount);
  pushUniqueIndex(desiredIndices, lateralIdealIdx, portCount);
  pushUniqueIndex(desiredIndices, centerIdx - 1, portCount);
  pushUniqueIndex(desiredIndices, centerIdx + 1, portCount);
  pushUniqueIndex(desiredIndices, lateralIdealIdx - 1, portCount);
  pushUniqueIndex(desiredIndices, lateralIdealIdx + 1, portCount);

  if (preferOuterLateral) {
    pushUniqueIndex(desiredIndices, 0, portCount);
    pushUniqueIndex(desiredIndices, portCount - 1, portCount);
  }

  const optionByIndex = new Map(allOptions.map((option) => [option.index, option] as const));
  const options = desiredIndices
    .map((index) => optionByIndex.get(index))
    .filter((option): option is PortOption => option !== undefined)
    .slice(0, HARD_MAX_PORT_OPTIONS_PER_FACE);

  if (options.length >= DEFAULT_MAX_PORT_OPTIONS_PER_FACE) {
    return options.slice(0, DEFAULT_MAX_PORT_OPTIONS_PER_FACE);
  }

  const extras = ranked.filter((option) => !options.some((existing) => existing.index === option.index));
  return [...options, ...extras].slice(0, DEFAULT_MAX_PORT_OPTIONS_PER_FACE);
}

function mapPairCandidate(
  candidate: EdgeFaceCandidate,
  sourceOption: PortOption,
  destinationOption: PortOption,
): EdgePortPairCandidate {
  return {
    ...candidate,
    sourceAnchor: sourceOption.anchor,
    destinationAnchor: destinationOption.anchor,
    sourcePortIndex: sourceOption.index,
    destinationPortIndex: destinationOption.index,
    sourcePortCount: sourceOption.count,
    destinationPortCount: destinationOption.count,
    sourcePortLocalScore: sourceOption.localScore,
    destinationPortLocalScore: destinationOption.localScore,
    sourceLateralClass: sourceOption.lateralClass,
    destinationLateralClass: destinationOption.lateralClass,
  };
}

function rankPairCandidate(candidate: EdgePortPairCandidate): number {
  const sourceScore = candidate.sourcePortLocalScore ?? 0;
  const destinationScore = candidate.destinationPortLocalScore ?? 0;
  const sourceCenterBias = Math.abs((candidate.sourcePortIndex ?? 0) - Math.floor((candidate.sourcePortCount ?? 1) / 2));
  const destinationCenterBias = Math.abs((candidate.destinationPortIndex ?? 0) - Math.floor((candidate.destinationPortCount ?? 1) / 2));
  return sourceScore + destinationScore + sourceCenterBias * 2 + destinationCenterBias;
}

function filterGroupVerticalDestinationOptions(
  options: ReadonlyArray<PortOption>,
  candidate: EdgeFaceCandidate,
  fromPos: Vec3,
  toPos: Vec3,
  toSize: readonly [number, number, number],
  destinationIsGroup: boolean,
): ReadonlyArray<PortOption> {
  if (!destinationIsGroup) return options;
  const dstIsVertical = candidate.dstFace === 'top' || candidate.dstFace === 'bottom';
  // For side-face (left/right) entries into a group, always prefer the centre Y port.
  // The lateral bias in buildPortOptions pulls the port toward the source's Y level
  // which causes top-edge landings when the source is above the group. Groups should
  // be entered at their vertical centre on side faces for visual consistency.
  if (!dstIsVertical) {
    const dstIsSide = candidate.dstFace === 'left' || candidate.dstFace === 'right';
    if (dstIsSide) {
      const centeredOptions = options.filter((option) =>
        option.lateralClass === 'center' || option.lateralClass === 'inner',
      );
      return centeredOptions.length > 0 ? centeredOptions : options;
    }
    return options;
  }
  const lateralOffset = Math.abs(fromPos[0] - toPos[0]);
  if (lateralOffset <= toSize[0] * 0.35) return options;
  const srcIsSide = candidate.srcFace === 'left' || candidate.srcFace === 'right';
  const hasBundleGuidance = candidate.bundleHint?.sourceGuideHint !== undefined;
  const shallowVerticalOffset = Math.abs(fromPos[1] - toPos[1]) <= toSize[1] * 1.15;

  if (srcIsSide && !hasBundleGuidance && shallowVerticalOffset) {
    const centeredOptions = options.filter((option) =>
      option.lateralClass === 'center' || option.lateralClass === 'inner',
    );
    return centeredOptions.length > 0 ? centeredOptions : options;
  }

  const outerOptions = options.filter((option) =>
    option.lateralClass === 'outer' || option.lateralClass === 'edge',
  );
  return outerOptions.length > 0 ? outerOptions : options;
}

export function enumeratePortPairCandidates(
  candidate: EdgeFaceCandidate,
  request: EdgeRoutingRequest,
  nodeMap: RoutingNodeMap,
  groupIds: ReadonlySet<string> = new Set(),
): ReadonlyArray<EdgePortPairCandidate> {
  const fromNode = nodeMap.get(request.fromId);
  const toNode = nodeMap.get(request.toId);

  if (!fromNode || !toNode) {
    return [{
      ...candidate,
      sourceAnchor: [0, 0, 0],
      destinationAnchor: [0, 0, 0],
    }];
  }

  const { position: fromPos, size: fromSize } = fromNode;
  const { position: toPos, size: toSize } = toNode;
  const thickness = request.thickness;
  const destinationIsGroup = groupIds.has(request.toId);

  if (candidate.bundleHint?.sourceAnchorHint) {
    const destinationOptions = filterGroupVerticalDestinationOptions(
      buildPortOptions(
      toPos,
      toSize,
      candidate.dstFace,
      fromPos,
      thickness,
      false,
      candidate.destinationFaceLocked,
      candidate.sourceFaceLocked,
      destinationIsGroup,
      ),
      candidate,
      fromPos,
      toPos,
      toSize,
      destinationIsGroup,
    );
    const ranked = destinationOptions
      .map((destinationOption) => ({
        ...candidate,
        sourceAnchor: candidate.bundleHint!.sourceAnchorHint!,
        destinationAnchor: destinationOption.anchor,
        destinationPortIndex: destinationOption.index,
        destinationPortCount: destinationOption.count,
        destinationPortLocalScore: destinationOption.localScore,
        destinationLateralClass: destinationOption.lateralClass,
      }))
      .sort((a, b) => rankPairCandidate(a as EdgePortPairCandidate) - rankPairCandidate(b as EdgePortPairCandidate));
    return ranked.length > 0
      ? ranked.slice(0, MAX_PORT_PAIR_CANDIDATES_PER_FACE_PAIR) as ReadonlyArray<EdgePortPairCandidate>
      : [{
        ...candidate,
        sourceAnchor: candidate.bundleHint.sourceAnchorHint,
        destinationAnchor: getFaceCenterForPort(toPos, toSize, candidate.dstFace),
      }];
  }

  const sourceOptions = buildPortOptions(
    fromPos,
    fromSize,
    candidate.srcFace,
    toPos,
    thickness,
    true,
    candidate.sourceFaceLocked || (request.routing === 'flow' && (candidate.srcFace === 'left' || candidate.srcFace === 'right')),
    candidate.sourceFaceLocked,
  );
  const destinationOptions = filterGroupVerticalDestinationOptions(
    buildPortOptions(
    toPos,
    toSize,
    candidate.dstFace,
    fromPos,
    thickness,
    false,
    candidate.destinationFaceLocked,
    candidate.sourceFaceLocked,
    destinationIsGroup,
    ),
    candidate,
    fromPos,
    toPos,
    toSize,
    destinationIsGroup,
  );

  const pairCandidates: EdgePortPairCandidate[] = [];
  const seen = new Set<string>();
  for (const sourceOption of sourceOptions) {
    for (const destinationOption of destinationOptions) {
      const key = `${sourceOption.index}:${destinationOption.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairCandidates.push(mapPairCandidate(candidate, sourceOption, destinationOption));
    }
  }

  if (pairCandidates.length === 0) {
    return [{
      ...candidate,
      sourceAnchor: getFaceCenterForPort(fromPos, fromSize, candidate.srcFace),
      destinationAnchor: getFaceCenterForPort(toPos, toSize, candidate.dstFace),
    }];
  }

  const centerCenter = pairCandidates.find((entry) =>
    entry.sourcePortIndex === Math.floor((entry.sourcePortCount ?? 1) / 2) &&
    entry.destinationPortIndex === Math.floor((entry.destinationPortCount ?? 1) / 2),
  );

  const forced = new Set<EdgePortPairCandidate>();
  if (pairCandidates[0]) forced.add(pairCandidates[0]!);
  if (centerCenter) forced.add(centerCenter);
  if (destinationIsGroup) {
    pairCandidates
      .filter((entry) => entry.destinationLateralClass === 'outer' || entry.destinationLateralClass === 'edge')
      .forEach((entry) => forced.add(entry));
  }

  const remaining = pairCandidates
    .filter((entry) => !forced.has(entry))
    .sort((a, b) => rankPairCandidate(a) - rankPairCandidate(b));

  const selected = [...forced];
  const usedSourceIndices = new Set(selected.map((entry) => entry.sourcePortIndex));
  const usedDestinationIndices = new Set(selected.map((entry) => entry.destinationPortIndex));

  for (const entry of remaining) {
    if (selected.length >= MAX_PORT_PAIR_CANDIDATES_PER_FACE_PAIR) break;
    const addsDiversity =
      !usedSourceIndices.has(entry.sourcePortIndex) ||
      !usedDestinationIndices.has(entry.destinationPortIndex);
    if (addsDiversity || selected.length < 8) {
      selected.push(entry);
      usedSourceIndices.add(entry.sourcePortIndex);
      usedDestinationIndices.add(entry.destinationPortIndex);
    }
  }

  for (const entry of remaining) {
    if (selected.length >= MAX_PORT_PAIR_CANDIDATES_PER_FACE_PAIR) break;
    if (!selected.includes(entry)) selected.push(entry);
  }

  return selected
    .sort((a, b) => rankPairCandidate(a) - rankPairCandidate(b))
    .slice(0, MAX_PORT_PAIR_CANDIDATES_PER_FACE_PAIR);
}

export const enumeratePortCandidates = enumeratePortPairCandidates;

export function assignPorts(
  candidate: EdgeFaceCandidate,
  request: EdgeRoutingRequest,
  nodeMap: RoutingNodeMap,
  groupIds: ReadonlySet<string> = new Set(),
): EdgePortCandidate {
  return enumeratePortPairCandidates(candidate, request, nodeMap, groupIds)[0] ?? {
    ...candidate,
    sourceAnchor: [0, 0, 0],
    destinationAnchor: [0, 0, 0],
  };
}

function getFaceCenterForPort(
  pos: Vec3,
  size: readonly [number, number, number],
  face: FaceId,
): Vec3 {
  const [x, y, z] = pos;
  const [w, h, d] = size;
  switch (face) {
    case 'left':   return [x - w / 2, y, z];
    case 'right':  return [x + w / 2, y, z];
    case 'top':    return [x, y + h / 2, z];
    case 'bottom': return [x, y - h / 2, z];
    case 'front':  return [x, y, z + d / 2];
    case 'back':   return [x, y, z - d / 2];
  }
}
