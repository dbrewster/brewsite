// Pure utility class. No side effects, no mutable state. Fully testable in isolation.
// Instantiated once in useSceneEngine when sceneTrack.progressProfile is present.
// Called every frame via getGlobalProgress() (remap) and on user navigation (inverse).

import type { SceneProgressProfile, SceneProgressSegment } from '../compiler/sceneTrackTypes';
import { IDENTITY_FN } from '../compiler/identityFn';
import { clamp01 } from '../math';
export { IDENTITY_FN };

export class SceneProgressMapper {
  private readonly segments: readonly SceneProgressSegment[];

  constructor(profile: SceneProgressProfile) {
    this.segments = profile.segments;
  }

  /**
   * Maps raw input progress [0..1] to engine progress [0..1].
   * Hot path — called every frame. O(N) where N = scene count (linear scan).
   */
  remap(rawProgress: number): number {
    const p = clamp01(rawProgress);
    const segs = this.segments;

    // Edge cases
    if (p <= 0) return 0;
    if (p >= 1) return 1;

    // Find the segment that contains p.
    // Linear scan is correct — scene counts are always small (< 100 in practice).
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i]!;
      if (p <= seg.rawEnd || i === segs.length - 1) {
        const localT = (p - seg.rawStart) / (seg.rawEnd - seg.rawStart);
        const localEngine = seg.fn(clamp01(localT));
        return seg.engineStart + localEngine * (seg.engineEnd - seg.engineStart);
      }
    }

    return 1; // unreachable — satisfies TypeScript
  }

  /**
   * Maps engine progress [0..1] back to raw input progress [0..1].
   * Cold path — called only from scrollToProgress() on user navigation.
   * Uses binary search for non-identity fn. O(N * log(1/tolerance)).
   */
  inverse(engineProgress: number): number {
    const ep = clamp01(engineProgress);
    if (ep <= 0) return 0;
    if (ep >= 1) return 1;

    const segs = this.segments;

    // Find the segment that contains ep in engine space
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i]!;
      if (ep <= seg.engineEnd || i === segs.length - 1) {
        // Normalize ep to local engine space [0..1]
        const localEngine = (ep - seg.engineStart) / (seg.engineEnd - seg.engineStart);

        // Edge cases: avoid binary search when at segment boundaries.
        // localEngine=0 → localT=0, localEngine≥1 → localT=1 (handles flat-derivative endpoints).
        if (localEngine <= 0) return seg.rawStart;
        if (localEngine >= 1) return seg.rawEnd;

        // Invert fn: find localT such that fn(localT) ≈ localEngine
        let localT: number;
        if (seg.fn === SceneProgressMapper.IDENTITY_FN || isIdentityFn(seg.fn)) {
          localT = localEngine; // O(1) for identity
        } else {
          localT = binarySearchInverse(seg.fn, localEngine, 1e-5, 20);
        }

        // Denormalize back to raw input space
        return seg.rawStart + localT * (seg.rawEnd - seg.rawStart);
      }
    }

    return 1;
  }

  /** Reference to the canonical identity function for fast-path detection.
   *  Points to the module-level IDENTITY_FN export — same reference used by
   *  progressManager.ts and sceneTrackCompiler.ts for the isUniform check. */
  static readonly IDENTITY_FN = IDENTITY_FN;
}

/** Binary search for the input t such that fn(t) ≈ target, in [0..1]. */
function binarySearchInverse(
  fn: (t: number) => number,
  target: number,
  tolerance: number,
  maxIterations: number,
): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < maxIterations; i++) {
    const mid = (lo + hi) / 2;
    const value = fn(mid);
    if (Math.abs(value - target) < tolerance) return mid;
    if (value < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Cheap heuristic to detect if a function is behaviorally identity.
 * Samples three interior points. Used to skip binary search in the common case.
 * Not a proof — just a fast-path optimization.
 */
function isIdentityFn(fn: (t: number) => number): boolean {
  const tol = 0.0001;
  return (
    Math.abs(fn(0.25) - 0.25) < tol &&
    Math.abs(fn(0.5) - 0.5) < tol &&
    Math.abs(fn(0.75) - 0.75) < tol
  );
}
