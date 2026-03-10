// Lexicographic candidate selection for the edge routing pipeline.

import type { EdgeCandidateRankKey, ScoredEdgeCandidate } from './routingTypes';

/**
 * Compare two lexicographic rank key tuples element by element.
 * Returns negative if a < b (a is better), positive if a > b, 0 if equal.
 */
function compareRankKeys(a: EdgeCandidateRankKey, b: EdgeCandidateRankKey): number {
  for (let i = 0; i < a.length; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function compareTieBreak(a: ScoredEdgeCandidate, b: ScoredEdgeCandidate): number {
  const aLocal = (a.sourcePortLocalScore ?? 0) + (a.destinationPortLocalScore ?? 0);
  const bLocal = (b.sourcePortLocalScore ?? 0) + (b.destinationPortLocalScore ?? 0);
  if (Math.abs(aLocal - bLocal) > 1e-9) return aLocal - bLocal;

  const aCenter = Math.abs((a.sourcePortIndex ?? 0) - Math.floor((a.sourcePortCount ?? 1) / 2));
  const bCenter = Math.abs((b.sourcePortIndex ?? 0) - Math.floor((b.sourcePortCount ?? 1) / 2));
  if (aCenter !== bCenter) return aCenter - bCenter;

  return 0;
}

/**
 * Select the winning candidate from a scored set using lexicographic comparison
 * of rank keys. Returns null only when the input array is empty (callers handle
 * the empty case by invoking the fallback path described in plan Section 14.2).
 * Never collapses rank keys into a weighted sum.
 */
export function selectBestCandidate(
  candidates: ReadonlyArray<ScoredEdgeCandidate>,
): ScoredEdgeCandidate | null {
  if (candidates.length === 0) return null;

  let best = candidates[0]!;
  for (let i = 1; i < candidates.length; i++) {
    const cmp = compareRankKeys(candidates[i]!.rankKey, best.rankKey);
    if (cmp < 0 || (cmp === 0 && compareTieBreak(candidates[i]!, best) < 0)) {
      best = candidates[i]!;
    }
  }
  return best;
}
