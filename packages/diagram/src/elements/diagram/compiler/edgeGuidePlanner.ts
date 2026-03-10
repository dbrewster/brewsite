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
  _nodeMap: RoutingNodeMap,
): EdgeGuidedCandidate {
  const sourceNormal = getFaceNormalLocal(candidate.srcFace);
  const destinationNormal = getFaceNormalLocal(candidate.dstFace);
  const defaultRouteStart = addVec(candidate.sourceAnchor, scaleVec(sourceNormal, request.flowFaceStub));
  const defaultRouteEnd = addVec(candidate.destinationAnchor, scaleVec(destinationNormal, request.flowFaceStub));

  const sourceGuide = candidate.bundleHint?.sourceGuideHint;
  const routeStart = sourceGuide ?? defaultRouteStart;
  const routeEnd = defaultRouteEnd;

  return {
    ...candidate,
    sourceGuide,
    destinationGuide: undefined,
    routeStart,
    routeEnd,
  };
}
