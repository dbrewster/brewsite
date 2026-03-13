// Structured candidate scoring and lexicographic rank key projection for the routing pipeline.

import type {
  EdgeCandidateRankKey,
  EdgeCandidateScore,
  FaceId,
  RoutedEdgeCandidate,
  Vec3,
} from './routingTypes';
import { getFaceNormal } from './edgeRouter';

// ─── Scoring sub-metrics ──────────────────────────────────────────────────────

const OVERSHOOT_TOLERANCE = 0.06;
const BLOCKER_HIT_PENALTY = 500;
const UNDERPASS_PENALTY = 200;

// TODO: distinguish penetration-depth penalty from simple hit count (BLOCKER_PENETRATION_PENALTY).
// Currently all obstacle hits are counted equally regardless of intersection depth.

function computeOvershootPenalty(
  waypoints: ReadonlyArray<Vec3>,
  fromPos: Vec3,
  toPos: Vec3,
): number {
  if (waypoints.length === 0) return 0;
  const axisX = toPos[0] - fromPos[0];
  const axisY = toPos[1] - fromPos[1];
  const axisZ = toPos[2] - fromPos[2];
  const axisLenSq = axisX * axisX + axisY * axisY + axisZ * axisZ;
  if (axisLenSq <= 1e-9) return 0;

  let overshoot = 0;
  for (const point of waypoints) {
    const relX = point[0] - fromPos[0];
    const relY = point[1] - fromPos[1];
    const relZ = point[2] - fromPos[2];
    const t = (relX * axisX + relY * axisY + relZ * axisZ) / axisLenSq;
    if (t < -OVERSHOOT_TOLERANCE) {
      overshoot += (-OVERSHOOT_TOLERANCE - t);
    } else if (t > 1 + OVERSHOOT_TOLERANCE) {
      overshoot += (t - (1 + OVERSHOOT_TOLERANCE));
    }
  }
  return overshoot;
}

function computeEndpointAlignmentPenalty(
  waypoints: ReadonlyArray<Vec3>,
  srcFace: FaceId,
  dstFace: FaceId,
): number {
  if (waypoints.length < 2) return 2;
  const start = waypoints[0]!;
  const next = waypoints[1]!;
  const prev = waypoints[waypoints.length - 2]!;
  const end = waypoints[waypoints.length - 1]!;

  const srcDirX = next[0] - start[0];
  const srcDirY = next[1] - start[1];
  const srcDirZ = next[2] - start[2];
  const srcLen = Math.sqrt(srcDirX ** 2 + srcDirY ** 2 + srcDirZ ** 2) || 1;
  const srcDir: Vec3 = [srcDirX / srcLen, srcDirY / srcLen, srcDirZ / srcLen];

  const dstInX = prev[0] - end[0];
  const dstInY = prev[1] - end[1];
  const dstInZ = prev[2] - end[2];
  const dstLen = Math.sqrt(dstInX ** 2 + dstInY ** 2 + dstInZ ** 2) || 1;
  const dstIn: Vec3 = [dstInX / dstLen, dstInY / dstLen, dstInZ / dstLen];

  const srcNormal = getFaceNormal(srcFace);
  const dstNormal = getFaceNormal(dstFace);
  const srcAlign = Math.max(-1, Math.min(1, srcDir[0] * srcNormal[0] + srcDir[1] * srcNormal[1] + srcDir[2] * srcNormal[2]));
  const dstAlign = Math.max(-1, Math.min(1, dstIn[0] * dstNormal[0] + dstIn[1] * dstNormal[1] + dstIn[2] * dstNormal[2]));
  return (1 - srcAlign) + (1 - dstAlign);
}

function computeFaceDirectionPenalty(
  fromPos: Vec3,
  toPos: Vec3,
  srcFace: FaceId,
  dstFace: FaceId,
): number {
  const dx = toPos[0] - fromPos[0];
  const dy = toPos[1] - fromPos[1];
  const dz = toPos[2] - fromPos[2];
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  const dir: Vec3 = [dx / len, dy / len, dz / len];
  const srcNormal = getFaceNormal(srcFace);
  const dstNormal = getFaceNormal(dstFace);
  const srcToward = srcNormal[0] * dir[0] + srcNormal[1] * dir[1] + srcNormal[2] * dir[2];
  const dstToward = dstNormal[0] * -dir[0] + dstNormal[1] * -dir[1] + dstNormal[2] * -dir[2];
  return (1 - Math.max(0, srcToward)) + (1 - Math.max(0, dstToward));
}

function computeNearEdgePenalty(
  nodePos: Vec3,
  nodeSize: readonly [number, number, number],
  face: FaceId,
  targetPos: Vec3,
): number {
  const span =
    face === 'top' || face === 'bottom'
      ? nodeSize[0]
      : face === 'left' || face === 'right'
        ? nodeSize[1]
        : 0;
  if (span <= 0) return 0;
  const center = face === 'top' || face === 'bottom' ? nodePos[0] : nodePos[1];
  const target = face === 'top' || face === 'bottom' ? targetPos[0] : targetPos[1];
  const halfSpan = Math.max(0.001, span * 0.5);
  const normalized = Math.min(1, Math.abs(target - center) / halfSpan);
  return Math.pow(normalized, 3);
}

function resolveGroupApproachX(candidate: RoutedEdgeCandidate, fromPos: Vec3): number {
  return candidate.bundleHint?.sourceGuideHint?.[0]
    ?? candidate.bundleHint?.sourceAnchorHint?.[0]
    ?? fromPos[0];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute a structured score for a single routed candidate.
 * All metrics are read from candidate geometry — no profile-specific branching.
 * Pre-computed bendCount and pathLength are used directly from the profile output.
 *
 * @param hintedTrunkKey - The shared trunk key inferred for this edge by inferBundleHints,
 *   or undefined if no bundle hint was generated. When undefined, sharedPathPenalty is always
 *   zero (no bundle hint means no preference). When defined, only candidates whose
 *   sharedTrunkKey matches the hint receive zero penalty; non-trunk candidates pay 1.
 */
export function scoreCandidate(
  candidate: RoutedEdgeCandidate,
  fromPos: Vec3,
  toPos: Vec3,
  fromSize: readonly [number, number, number],
  toSize: readonly [number, number, number],
  hintedTrunkKey: string | undefined,
): EdgeCandidateScore {
  const { waypoints, bendCount, pathLength } = candidate.geometry;

  // Blocker penalty from obstacle IDs logged by the profile.
  const hitCount = candidate.geometry.obstacleIds?.length ?? 0;
  const blockerPenalty =
    hitCount * BLOCKER_HIT_PENALTY +
    (candidate.geometry.usedUnderpass ? UNDERPASS_PENALTY : 0) +
    candidate.geometry.groupIngressPenalty * BLOCKER_HIT_PENALTY;

  // Overshoot penalty: route waypoints that stray beyond the source-to-target axis.
  const overshootPenalty = computeOvershootPenalty(waypoints, fromPos, toPos) * 1800;
  const acuteTurnPenalty = candidate.geometry.acuteTurnCount * 10000 + candidate.geometry.orthogonalDeviationPenalty;
  const reversalPenalty = candidate.geometry.reversalCount * 5000;

  // Shared-path penalty: 0 when no bundle hint exists for this edge (all candidates equal),
  // 0 when the candidate's trunk key matches the inferred hint, 1 otherwise.
  // Per plan Section 12.2: shared trunk preference is a tie-breaker only — it must
  // not dominate directness, bend count, or path length.
  const sharedPathPenalty =
    hintedTrunkKey === undefined
      ? 0
      : candidate.sharedTrunkKey === hintedTrunkKey
        ? 0
        : 1;

  // Heuristic penalties: alignment, direction, near-edge.
  const alignmentPenalty = computeEndpointAlignmentPenalty(waypoints, candidate.srcFace, candidate.dstFace);
  const directionPenalty = computeFaceDirectionPenalty(fromPos, toPos, candidate.srcFace, candidate.dstFace);
  const nearEdgePenalty =
    computeNearEdgePenalty(fromPos, fromSize, candidate.srcFace, toPos) +
    computeNearEdgePenalty(toPos, toSize, candidate.dstFace, fromPos);
  const destinationLooksLikeGroup = toSize[2] <= 0.02;
  let groupFacePenalty = 0;
  let groupSlotPenalty = 0;
  if (destinationLooksLikeGroup) {
    const absDx = Math.abs(toPos[0] - fromPos[0]);
    const absDy = Math.abs(toPos[1] - fromPos[1]);
    const verticalDominant = absDy > absDx * 0.9;
    const horizontalDominant = absDx > absDy * 1.1;
    const dstIsSide = candidate.dstFace === 'left' || candidate.dstFace === 'right';
    const dstIsVertical = candidate.dstFace === 'top' || candidate.dstFace === 'bottom';
    const approachX = resolveGroupApproachX(candidate, fromPos);
    const approachFromLeft = approachX < toPos[0] - toSize[0] * 0.1;
    const approachFromRight = approachX > toPos[0] + toSize[0] * 0.1;
    const hasDirectedSideApproach = approachFromLeft || approachFromRight;
    if (verticalDominant && dstIsSide && !hasDirectedSideApproach) groupFacePenalty += 760;
    if (horizontalDominant && dstIsVertical) groupFacePenalty += 220;
    if (candidate.sourceFaceLocked && hasDirectedSideApproach && dstIsVertical) {
      groupFacePenalty += 360;
    }
    if (verticalDominant && dstIsSide) {
      if (approachFromLeft && candidate.dstFace === 'right') groupFacePenalty += 640;
      if (approachFromRight && candidate.dstFace === 'left') groupFacePenalty += 640;
    }

    const destinationLateralClass = candidate.destinationLateralClass ?? 'center';
    if (dstIsVertical && absDx > toSize[0] * 0.35 && (destinationLateralClass === 'center' || destinationLateralClass === 'inner')) {
      groupSlotPenalty += 420;
    }

    const ingress = candidate.geometry.debug?.destinationGroupIngress;
    if (
      ingress?.corridorBlocked &&
      dstIsVertical &&
      ingress.lateralOffset >= toSize[0] * 0.75 &&
      absDy >= Math.max(toSize[1] * 1.35, fromSize[1] * 2.2)
    ) {
      groupFacePenalty += 6000;
    }
  }

  const heuristicPenalty =
    alignmentPenalty * 100 +
    directionPenalty * 400 +
    nearEdgePenalty * 320 +
    groupFacePenalty +
    groupSlotPenalty;

  return {
    blockerPenalty,
    overshootPenalty,
    acuteTurnPenalty,
    reversalPenalty,
    bendCount,
    pathLength,
    sharedPathPenalty,
    heuristicPenalty,
  };
}

/**
 * Project a structured score into a lexicographic rank key tuple.
 * The tuple ordering matches the required selection priority (plan Section 12.1).
 */
export function candidateToRankKey(score: EdgeCandidateScore): EdgeCandidateRankKey {
  return [
    score.blockerPenalty,
    score.overshootPenalty,
    score.acuteTurnPenalty,
    score.reversalPenalty,
    score.bendCount,
    score.pathLength,
    score.sharedPathPenalty,
    score.heuristicPenalty,
  ];
}
