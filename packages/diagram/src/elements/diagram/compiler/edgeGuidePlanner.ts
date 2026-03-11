// Guide point generation for the edge routing candidate pipeline.

import type {
  EdgeGuidedCandidate,
  EdgePortCandidate,
  EdgeRoutingRequest,
  FaceId,
  RoutingNodeMap,
  Vec3,
} from './routingTypes';

const addVec = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scaleVec = (v: Vec3, s: number): Vec3 => [v[0] * s, v[1] * s, v[2] * s];
const subVec = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dotVec = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

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

export function buildCandidateGuides(
  candidate: EdgePortCandidate,
  request: EdgeRoutingRequest,
  nodeMap: RoutingNodeMap,
  groupIds: ReadonlySet<string> = new Set(),
): EdgeGuidedCandidate {
  const sourceNormal = getFaceNormalLocal(candidate.srcFace);
  const destinationNormal = getFaceNormalLocal(candidate.dstFace);
  const defaultRouteStart = addVec(candidate.sourceAnchor, scaleVec(sourceNormal, request.flowFaceStub));
  const defaultRouteEnd = addVec(candidate.destinationAnchor, scaleVec(destinationNormal, request.flowFaceStub));

  const sourceGuide = candidate.bundleHint?.sourceGuideHint;
  let destinationGuide: Vec3 | undefined;
  if (request.routing === 'flow' && request.flowTargetApproachBias > 0) {
    const fromNode = nodeMap.get(request.fromId);
    const toNode = nodeMap.get(request.toId);
    if (fromNode && toNode) {
      const destinationIsGroup = groupIds.has(request.toId);
      const destinationUsesVerticalIngress =
        candidate.dstFace === 'top' || candidate.dstFace === 'bottom';
      const towardSource = subVec(fromNode.position, candidate.destinationAnchor);
      const facesSource = dotVec(destinationNormal, towardSource) > 1e-6;
      const sourceFaceParallelEnough = !candidate.sourceFaceLocked ||
        Math.abs(dotVec(sourceNormal, destinationNormal)) >= 0.1;

      if (facesSource && sourceFaceParallelEnough && !(destinationIsGroup && destinationUsesVerticalIngress)) {
        const guideDistance = request.flowFaceStub * request.flowTargetApproachBias;
        const candidateGuide = addVec(candidate.destinationAnchor, scaleVec(destinationNormal, guideDistance));
        const supportsSourceProgress = !sourceGuide || dotVec(subVec(candidateGuide, sourceGuide), sourceNormal) >= -1e-6;
        if (supportsSourceProgress) {
          destinationGuide = candidateGuide;
        }
      }
    }
  }
  const routeStart = sourceGuide ?? defaultRouteStart;
  const routeEnd = destinationGuide ?? defaultRouteEnd;

  // For bundled routes approaching a group's side face, cap the stub so the
  // approach waypoint stays on the same lateral side as the trunk. This prevents
  // control-point crossings when two sibling routes approach opposite inner faces.
  if (
    sourceGuide !== undefined &&
    (candidate.dstFace === 'left' || candidate.dstFace === 'right') &&
    groupIds.has(request.toId)
  ) {
    const trunkX = sourceGuide[0];
    const anchorX = candidate.destinationAnchor[0];
    const lateralGap = Math.abs(anchorX - trunkX);
    const safeStubLength = Math.min(request.flowFaceStub, lateralGap * 0.75);
    if (safeStubLength < request.flowFaceStub - 1e-9) {
      const destinationNormalLocal = getFaceNormalLocal(candidate.dstFace);
      const adjustedRouteEnd = addVec(
        candidate.destinationAnchor,
        scaleVec(destinationNormalLocal, safeStubLength),
      );
      return {
        ...candidate,
        sourceGuide,
        destinationGuide,
        routeStart,
        routeEnd: adjustedRouteEnd,
      };
    }
  }

  return {
    ...candidate,
    sourceGuide,
    destinationGuide,
    routeStart,
    routeEnd,
  };
}
