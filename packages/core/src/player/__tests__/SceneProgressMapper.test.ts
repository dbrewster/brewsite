import { describe, it, expect } from 'vitest';
import { SceneProgressMapper, IDENTITY_FN } from '../SceneProgressMapper';
import type { SceneProgressProfile } from '../../compiler/sceneTrackTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a two-scene profile with given scrollUnits and optional fn overrides. */
const twoSceneProfile = (
  units0: number,
  units1: number,
  fn0 = IDENTITY_FN,
  fn1 = IDENTITY_FN,
): SceneProgressProfile => {
  const totalUnits = units0 + units1;
  return {
    isUniform: false,
    segments: [
      {
        sceneIndex: 0,
        rawStart: 0,
        rawEnd: units0 / totalUnits,
        engineStart: 0,
        engineEnd: 0.5,
        fn: fn0,
      },
      {
        sceneIndex: 1,
        rawStart: units0 / totalUnits,
        rawEnd: 1,
        engineStart: 0.5,
        engineEnd: 1,
        fn: fn1,
      },
    ],
  };
};

/** Build a three-scene profile with given scrollUnits (identity fn for all).
 *  units[2] is the last scene — it has no outgoing transition and does not
 *  contribute to totalUnits, matching buildProgressProfile semantics. */
const threeSceneProfile = (units: [number, number, number]): SceneProgressProfile => {
  const [u0, u1] = units; // u2 (last scene) excluded from totalUnits
  const total = u0 + u1;
  const r0 = u0 / total;
  return {
    isUniform: false,
    segments: [
      { sceneIndex: 0, rawStart: 0,  rawEnd: r0, engineStart: 0,   engineEnd: 0.5, fn: IDENTITY_FN },
      { sceneIndex: 1, rawStart: r0, rawEnd: 1,  engineStart: 0.5, engineEnd: 1,   fn: IDENTITY_FN },
    ],
  };
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SceneProgressMapper', () => {
  it('1. Identity profile: remap(t) === t for all t in [0, 1]', () => {
    // With IDENTITY_FN, remap should pass through without change.
    const profile = twoSceneProfile(1, 1);
    const mapper = new SceneProgressMapper(profile);
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      expect(mapper.remap(t)).toBeCloseTo(t, 5);
    }
  });

  it('2. remap(0) === 0 and remap(1) === 1', () => {
    const profile = twoSceneProfile(3, 1);
    const mapper = new SceneProgressMapper(profile);
    expect(mapper.remap(0)).toBe(0);
    expect(mapper.remap(1)).toBe(1);
  });

  it('3. Non-uniform weights: segment boundaries correct', () => {
    // Scene 0 is 3× wider: scrollUnits=[3, 1]
    // Segment 0: raw [0..0.75], engine [0..0.5]
    // Segment 1: raw [0.75..1], engine [0.5..1]
    const profile = twoSceneProfile(3, 1);
    const mapper = new SceneProgressMapper(profile);

    // At raw=0.375 (midpoint of segment 0): localT=0.5, engine = 0 + 0.5 * 0.5 = 0.25
    expect(mapper.remap(0.375)).toBeCloseTo(0.25, 5);

    // At raw=0.75 (boundary): engine=0.5
    expect(mapper.remap(0.75)).toBeCloseTo(0.5, 5);

    // At raw=0.875 (midpoint of segment 1): localT=0.5, engine = 0.5 + 0.5 * 0.5 = 0.75
    expect(mapper.remap(0.875)).toBeCloseTo(0.75, 5);
  });

  it('4. inverse(remap(t)) ≈ t for identity fn', () => {
    const profile = twoSceneProfile(3, 1);
    const mapper = new SceneProgressMapper(profile);
    const testPoints = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
    for (const t of testPoints) {
      const remapped = mapper.remap(t);
      const inverted = mapper.inverse(remapped);
      expect(inverted).toBeCloseTo(t, 4);
    }
  });

  it('4b. inverse(remap(t)) ≈ t for non-identity fn', () => {
    // easeInOut quadratic
    const easeInOutQuad = (t: number): number => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const profile = twoSceneProfile(1, 1, easeInOutQuad, easeInOutQuad);
    const mapper = new SceneProgressMapper(profile);
    const testPoints = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
    for (const t of testPoints) {
      const remapped = mapper.remap(t);
      const inverted = mapper.inverse(remapped);
      expect(inverted).toBeCloseTo(t, 3);
    }
  });

  it('5. Clamping: remap(-0.1) === 0, remap(1.1) === 1', () => {
    const profile = twoSceneProfile(1, 1);
    const mapper = new SceneProgressMapper(profile);
    expect(mapper.remap(-0.1)).toBe(0);
    expect(mapper.remap(1.1)).toBe(1);
  });

  it('6. Saturation fn (dwell pattern): holds at 1 after 25% of segment', () => {
    // fn = t => Math.min(1, t * 4): full animation plays in first 25% of scroll
    const satFn = (t: number): number => Math.min(1, t * 4);
    // Two equal scenes. Segment 0 covers raw [0..0.5], engine [0..0.5].
    const profile = twoSceneProfile(1, 1, satFn, IDENTITY_FN);
    const mapper = new SceneProgressMapper(profile);

    // At raw=0.125 (25% into segment 0): localT=0.25, fn(0.25)=1.0, engine=0.5*1=0.5
    expect(mapper.remap(0.125)).toBeCloseTo(0.5, 5);

    // At raw=0.25 (50% into segment 0): localT=0.5, fn(0.5)=1.0, engine=0.5*1=0.5
    expect(mapper.remap(0.25)).toBeCloseTo(0.5, 5);

    // At raw=0.4 (80% into segment 0): still capped at engine=0.5
    expect(mapper.remap(0.4)).toBeCloseTo(0.5, 5);
  });

  it('7. Three-scene non-uniform: segment rawEnd values sum to 1.0', () => {
    // units=[1, 3, 1] — middle scene is 3× wider
    const profile = threeSceneProfile([1, 3, 1]);
    const mapper = new SceneProgressMapper(profile);

    const segs = profile.segments;
    const lastSeg = segs[segs.length - 1]!;
    expect(lastSeg.rawEnd).toBeCloseTo(1.0, 10);

    // Verify remap is monotonically non-decreasing across 100 samples
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const val = mapper.remap(i / 100);
      expect(val).toBeGreaterThanOrEqual(prev - 1e-10);
      prev = val;
    }
  });

  it('IDENTITY_FN static reference matches module export', () => {
    expect(SceneProgressMapper.IDENTITY_FN).toBe(IDENTITY_FN);
  });
});
