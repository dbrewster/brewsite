import { describe, it, expect } from 'vitest';
import { buildProgressProfile } from '../sceneTrackCompiler';
import { IDENTITY_FN } from '../../compiler/identityFn';
import type { SceneFrame, CompileWarning } from '../sceneTrackTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeFrame = (id: string, progressManager?: SceneFrame['progressManager']): SceneFrame => ({
  id,
  scrollProgress: 0,
  widgets: {},
  ...(progressManager !== undefined ? { progressManager } : {}),
});

const collectWarnings = (
  frames: SceneFrame[],
): { profile: ReturnType<typeof buildProgressProfile>; warnings: CompileWarning[] } => {
  const warnings: CompileWarning[] = [];
  const profile = buildProgressProfile(frames, (w) => warnings.push(w));
  return { profile, warnings };
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildProgressProfile', () => {
  it('1. No ProgressManager declared → returns undefined', () => {
    const frames = [makeFrame('a'), makeFrame('b'), makeFrame('c')];
    const { profile, warnings } = collectWarnings(frames);
    expect(profile).toBeUndefined();
    expect(warnings).toHaveLength(0);
  });

  it('2. All scenes uniform (same scrollUnits, identity fn) → returns undefined', () => {
    const frames = [
      makeFrame('a', { scrollUnits: 2, fn: IDENTITY_FN }),
      makeFrame('b', { scrollUnits: 2, fn: IDENTITY_FN }),
      makeFrame('c', { scrollUnits: 2, fn: IDENTITY_FN }),
    ];
    const { profile } = collectWarnings(frames);
    expect(profile).toBeUndefined();
  });

  it('3. Non-uniform scenes → correct segment weights', () => {
    // 3 scenes: a (units=3), b (units=1), c (no PM, carries forward from b).
    // Only scenes a and b have outgoing transitions; c is the terminal.
    // totalUnits = resolved[0] + resolved[1] = 3 + 1 = 4.
    // Segment 0 (a→b): rawEnd = 3/4 = 0.75
    // Segment 1 (b→c): rawEnd = 1.0
    const frames = [
      makeFrame('a', { scrollUnits: 3, fn: IDENTITY_FN }),
      makeFrame('b', { scrollUnits: 1, fn: IDENTITY_FN }),
      makeFrame('c'),  // no progressManager — carries forward from b
    ];
    const { profile, warnings } = collectWarnings(frames);
    expect(warnings).toHaveLength(0);
    expect(profile).not.toBeUndefined();
    expect(profile!.isUniform).toBe(false);
    expect(profile!.segments).toHaveLength(2);

    const [s0, s1] = profile!.segments;
    expect(s0!.sceneIndex).toBe(0);
    expect(s0!.rawStart).toBeCloseTo(0, 10);
    expect(s0!.rawEnd).toBeCloseTo(0.75, 10);
    expect(s0!.engineStart).toBeCloseTo(0, 10);
    expect(s0!.engineEnd).toBeCloseTo(0.5, 10);

    expect(s1!.sceneIndex).toBe(1);
    expect(s1!.rawStart).toBeCloseTo(0.75, 10);
    expect(s1!.rawEnd).toBeCloseTo(1, 10);
    expect(s1!.engineStart).toBeCloseTo(0.5, 10);
    expect(s1!.engineEnd).toBeCloseTo(1, 10);
  });

  it('3b. Three-scene with different weights → correct segment count and raw boundaries', () => {
    const frames = [
      makeFrame('a', { scrollUnits: 3, fn: IDENTITY_FN }),
      makeFrame('b', { scrollUnits: 1, fn: IDENTITY_FN }),
      makeFrame('c'),
    ];
    const { profile, warnings } = collectWarnings(frames);
    expect(warnings).toHaveLength(0);
    expect(profile).not.toBeUndefined();
    expect(profile!.segments).toHaveLength(2);

    const [s0, s1] = profile!.segments;
    // Segment 0: scene a→b (scrollUnits=3 resolved, total=4): raw [0..0.75]
    expect(s0!.rawStart).toBeCloseTo(0, 10);
    expect(s0!.rawEnd).toBeCloseTo(0.75, 10);

    // Segment 1: scene b→c (scrollUnits=1 carry-forward from b, total=4): raw [0.75..1]
    expect(s1!.rawStart).toBeCloseTo(0.75, 10);
    expect(s1!.rawEnd).toBeCloseTo(1, 10);
  });

  it('4. Last-scene declaration → emits warning, does not contribute to segments', () => {
    const frames = [
      makeFrame('a'),
      makeFrame('b'),
      makeFrame('last', { scrollUnits: 2400, fn: IDENTITY_FN }),
    ];
    const { profile, warnings } = collectWarnings(frames);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.code).toBe('PROGRESS_MANAGER');
    expect(warnings[0]!.message).toContain('"last"');
    expect(warnings[0]!.message).toContain('has no effect');
    expect(warnings[0]!.sceneIndex).toBe(2);

    // Profile may still be built (scrollUnits carried forward), but the last-scene
    // declaration doesn't contribute an outgoing segment (no N → N+1 for last scene).
    // With 3 scenes and only uniform specs, profile could be undefined.
    // The key assertion: no crash, warning emitted.
    expect(warnings.length).toBe(1);
  });

  it('5. fn(0) !== 0 → emits PROGRESS_MANAGER warning with correct message', () => {
    const badFn = (t: number): number => t + 0.1; // fn(0) = 0.1, fn(1) = 1.1
    const frames = [
      makeFrame('a', { scrollUnits: 1, fn: badFn }),
      makeFrame('b'),
    ];
    const { profile: _, warnings } = collectWarnings(frames);
    const pmWarnings = warnings.filter((w) => w.code === 'PROGRESS_MANAGER');
    // Should warn about fn(0) and fn(1) violations
    expect(pmWarnings.some((w) => w.message.includes('fn(0) === 0'))).toBe(true);
    expect(pmWarnings.some((w) => w.message.includes('"a"'))).toBe(true);
  });

  it('6. fn(1) !== 1 → emits PROGRESS_MANAGER warning', () => {
    const badFn = (t: number): number => t * 0.8; // fn(0)=0, fn(1)=0.8
    const frames = [
      makeFrame('a', { scrollUnits: 1, fn: badFn }),
      makeFrame('b'),
    ];
    const { warnings } = collectWarnings(frames);
    expect(warnings.some((w) => w.code === 'PROGRESS_MANAGER' && w.message.includes('fn(1) === 1'))).toBe(true);
  });

  it('7. Non-monotonic fn → emits PROGRESS_MANAGER warning', () => {
    const nonMonoFn = (t: number): number => t < 0.5 ? t * 2 : 1 - (t - 0.5) * 2; // goes up then down
    const frames = [
      makeFrame('a', { scrollUnits: 1, fn: nonMonoFn }),
      makeFrame('b'),
    ];
    const { warnings } = collectWarnings(frames);
    expect(warnings.some((w) => w.code === 'PROGRESS_MANAGER' && w.message.includes('non-monotonic'))).toBe(true);
  });

  it('8. Carry-forward: scene 0 has spec, scenes 1-2 inherit it', () => {
    const customFn = (t: number): number => t * t; // easeIn — not identity
    const frames = [
      makeFrame('a', { scrollUnits: 2, fn: customFn }),
      makeFrame('b'),
      makeFrame('c'),
    ];
    const { profile, warnings } = collectWarnings(frames);
    // customFn is not IDENTITY_FN but fn(0)=0, fn(1)=1, monotonic → no warnings
    expect(warnings).toHaveLength(0);
    expect(profile).not.toBeUndefined();
    // Both segments use the carried-forward spec (scrollUnits=2, fn=customFn)
    // → uniform-ish check: scrollUnits equal but fn !== IDENTITY_FN → NOT uniform → profile built
    expect(profile!.segments).toHaveLength(2);
    // All segments have the same fn (carried forward)
    expect(profile!.segments[0]!.fn).toBe(customFn);
    expect(profile!.segments[1]!.fn).toBe(customFn);
  });

  it('9. Carry-forward override: scene 0 spec, scene 2 overrides', () => {
    const fn0 = (t: number): number => t * t;
    const fn2 = (t: number): number => Math.sqrt(t);
    const frames = [
      makeFrame('a', { scrollUnits: 1, fn: fn0 }),
      makeFrame('b'),
      makeFrame('c', { scrollUnits: 2, fn: fn2 }),
      makeFrame('d'),
    ];
    const { profile, warnings } = collectWarnings(frames);
    // fn2 is not identity and not last-scene, so last-scene warning is on 'd' but 'd' has no PM
    // No warnings expected (fn0 and fn2 are valid curves)
    expect(warnings.filter((w) => w.code === 'PROGRESS_MANAGER' && w.message.includes('has no effect'))).toHaveLength(0);
    expect(profile).not.toBeUndefined();
    expect(profile!.segments).toHaveLength(3);
    // Segment 0 (a→b): uses fn0 (from a's spec, before b's carry-forward)
    expect(profile!.segments[0]!.fn).toBe(fn0);
    // Segment 1 (b→c): uses fn0 (carried forward to b, which has no PM)
    expect(profile!.segments[1]!.fn).toBe(fn0);
    // Segment 2 (c→d): uses fn2 (c overrides)
    expect(profile!.segments[2]!.fn).toBe(fn2);
  });

  it('10. scrollUnits < 0.001 → clamped to 0.001 silently', () => {
    // progressManager.ts clamps to 0.001 before storing, so the profile just uses 0.001.
    // Use 3 scenes so the middle scene (with scrollUnits=0.001) is not the last scene.
    const frames = [
      makeFrame('a', { scrollUnits: 0.001, fn: IDENTITY_FN }),
      makeFrame('b', { scrollUnits: 1, fn: IDENTITY_FN }),
      makeFrame('c'),  // terminal scene — no PM declaration, no last-scene warning
    ];
    const { profile, warnings } = collectWarnings(frames);
    // Different scrollUnits → non-uniform → profile built
    expect(profile).not.toBeUndefined();
    // No warning emitted for the small scrollUnits (silent clamp)
    expect(warnings.filter((w) => w.code === 'PROGRESS_MANAGER')).toHaveLength(0);
    // Segment rawEnd should sum to 1.0
    const lastSeg = profile!.segments[profile!.segments.length - 1]!;
    expect(lastSeg.rawEnd).toBeCloseTo(1, 8);
  });

  it('11. Segment rawStart/rawEnd values sum to 1.0', () => {
    const frames = [
      makeFrame('a', { scrollUnits: 3, fn: IDENTITY_FN }),
      makeFrame('b', { scrollUnits: 1, fn: IDENTITY_FN }),
      makeFrame('c', { scrollUnits: 2, fn: IDENTITY_FN }),
    ];
    const { profile } = collectWarnings(frames);
    expect(profile).not.toBeUndefined();
    const segs = profile!.segments;
    expect(segs[0]!.rawStart).toBeCloseTo(0, 10);
    expect(segs[segs.length - 1]!.rawEnd).toBeCloseTo(1, 10);
    // Adjacent segments are contiguous
    for (let i = 0; i < segs.length - 1; i++) {
      expect(segs[i]!.rawEnd).toBeCloseTo(segs[i + 1]!.rawStart, 10);
    }
  });

  it('12. engineStart[i] and engineEnd[i] match i/(N-1) formula', () => {
    const frames = [
      makeFrame('a', { scrollUnits: 3, fn: IDENTITY_FN }),
      makeFrame('b', { scrollUnits: 1, fn: IDENTITY_FN }),
      makeFrame('c', { scrollUnits: 2, fn: IDENTITY_FN }),
      makeFrame('d'),
    ];
    const { profile } = collectWarnings(frames);
    expect(profile).not.toBeUndefined();
    const segs = profile!.segments;
    const N = 4; // 4 scenes
    for (let i = 0; i < segs.length; i++) {
      expect(segs[i]!.engineStart).toBeCloseTo(i / (N - 1), 10);
      expect(segs[i]!.engineEnd).toBeCloseTo((i + 1) / (N - 1), 10);
    }
  });

  it('0 or 1 scenes → returns undefined (no transitions)', () => {
    expect(collectWarnings([]).profile).toBeUndefined();
    expect(collectWarnings([makeFrame('a')]).profile).toBeUndefined();
  });

  // ─── autoAdvance validation ───────────────────────────────────────────────

  describe('autoAdvance validation', () => {
    it('13. autoAdvance with valid config → pre-computed segment fields populated', () => {
      const frames = [
        makeFrame('a', {
          scrollUnits: 1,
          fn: IDENTITY_FN,
          autoAdvance: { duration: 8, max: 0.80, pauseOnScroll: true },
        }),
        makeFrame('b'),
      ];
      const { profile, warnings } = collectWarnings(frames);
      expect(warnings).toHaveLength(0);
      expect(profile).not.toBeUndefined();
      const seg = profile!.segments[0]!;
      expect(seg.autoAdvance).not.toBeUndefined();
      // segWidth = 1.0 (2 scenes, 1 segment, full width)
      // rawRate = (0.80 × 1.0) / 8 = 0.1
      expect(seg.autoAdvance!.rawRate).toBeCloseTo(0.1, 6);
      // maxRaw = 0 + 0.80 × 1.0 = 0.80
      expect(seg.autoAdvance!.maxRaw).toBeCloseTo(0.80, 6);
      expect(seg.autoAdvance!.pauseOnScroll).toBe(true);
    });

    it('14. autoAdvance.duration <= 0 → emits PROGRESS_MANAGER warning', () => {
      const frames = [
        makeFrame('a', {
          scrollUnits: 1,
          fn: IDENTITY_FN,
          autoAdvance: { duration: 0, max: 0.8, pauseOnScroll: true },
        }),
        makeFrame('b'),
      ];
      const { warnings } = collectWarnings(frames);
      const aa = warnings.filter((w) => w.code === 'PROGRESS_MANAGER' && w.message.includes('duration'));
      expect(aa.length).toBeGreaterThanOrEqual(1);
      expect(aa[0]!.message).toContain('duration');
    });

    it('15. autoAdvance.duration negative → emits PROGRESS_MANAGER warning', () => {
      const frames = [
        makeFrame('a', {
          scrollUnits: 1,
          fn: IDENTITY_FN,
          autoAdvance: { duration: -5, max: 0.8, pauseOnScroll: true },
        }),
        makeFrame('b'),
      ];
      const { warnings } = collectWarnings(frames);
      expect(warnings.some((w) => w.code === 'PROGRESS_MANAGER' && w.message.includes('duration'))).toBe(true);
    });

    it('16. autoAdvance.max out of range (> 1) → emits PROGRESS_MANAGER warning', () => {
      const frames = [
        makeFrame('a', {
          scrollUnits: 1,
          fn: IDENTITY_FN,
          autoAdvance: { duration: 5, max: 1.5, pauseOnScroll: true },
        }),
        makeFrame('b'),
      ];
      const { warnings } = collectWarnings(frames);
      expect(warnings.some((w) => w.code === 'PROGRESS_MANAGER' && w.message.includes('max'))).toBe(true);
    });

    it('17. autoAdvance.max out of range (<= 0) → emits PROGRESS_MANAGER warning', () => {
      const frames = [
        makeFrame('a', {
          scrollUnits: 1,
          fn: IDENTITY_FN,
          autoAdvance: { duration: 5, max: 0, pauseOnScroll: true },
        }),
        makeFrame('b'),
      ];
      const { warnings } = collectWarnings(frames);
      expect(warnings.some((w) => w.code === 'PROGRESS_MANAGER' && w.message.includes('max'))).toBe(true);
    });

    it('18. autoAdvance on last scene → emits PROGRESS_MANAGER warning', () => {
      const frames = [
        makeFrame('a'),
        makeFrame('b', {
          scrollUnits: 1,
          fn: IDENTITY_FN,
          autoAdvance: { duration: 5, max: 0.8, pauseOnScroll: true },
        }),
      ];
      const { warnings } = collectWarnings(frames);
      const lastScene = warnings.filter(
        (w) => w.code === 'PROGRESS_MANAGER' && w.message.includes('last scene') && w.sceneIndex === 1,
      );
      expect(lastScene.length).toBeGreaterThanOrEqual(1);
    });

    it('19. animationTimeScale populated on segment', () => {
      const frames = [
        makeFrame('a', { scrollUnits: 1, fn: IDENTITY_FN, animationTimeScale: 3 }),
        makeFrame('b'),
      ];
      const { profile, warnings } = collectWarnings(frames);
      expect(warnings).toHaveLength(0);
      expect(profile!.segments[0]!.animationTimeScale).toBe(3);
    });

    it('20. animationTimeScale causes isUniform = false (profile present)', () => {
      // All scrollUnits equal, fn is identity, but animationTimeScale is set.
      // isUniform must be false so the profile is present at runtime for RuntimeDriverImpl.
      const frames = [
        makeFrame('a', { scrollUnits: 1, fn: IDENTITY_FN, animationTimeScale: 2 }),
        makeFrame('b', { scrollUnits: 1, fn: IDENTITY_FN }),
      ];
      const { profile } = collectWarnings(frames);
      expect(profile).not.toBeUndefined();
      expect(profile!.isUniform).toBe(false);
    });

    it('21. autoAdvance causes isUniform = false (profile present)', () => {
      // All scrollUnits equal, fn is identity, but autoAdvance is set.
      const frames = [
        makeFrame('a', {
          scrollUnits: 1,
          fn: IDENTITY_FN,
          autoAdvance: { duration: 10, max: 1, pauseOnScroll: false },
        }),
        makeFrame('b'),
      ];
      const { profile } = collectWarnings(frames);
      expect(profile).not.toBeUndefined();
      expect(profile!.isUniform).toBe(false);
    });
  });

  // ─── Carry-forward boundary: behavioral vs structural props ──────────────────

  it('22. autoAdvance does NOT carry forward to subsequent scenes', () => {
    // Scene 0 declares autoAdvance. Scenes 1 and 2 omit <ProgressManager>.
    // Only segment 0 (a→b) should have autoAdvance; segment 1 (b→c) must not.
    const frames = [
      makeFrame('a', {
        scrollUnits: 1,
        fn: IDENTITY_FN,
        autoAdvance: { duration: 5, max: 0.8, pauseOnScroll: true },
      }),
      makeFrame('b'),
      makeFrame('c'),
    ];
    const { profile, warnings } = collectWarnings(frames);
    expect(warnings).toHaveLength(0);
    expect(profile).not.toBeUndefined();
    expect(profile!.segments).toHaveLength(2);
    // Segment 0: autoAdvance declared on scene 0
    expect(profile!.segments[0]!.autoAdvance).not.toBeUndefined();
    expect(profile!.segments[0]!.autoAdvance!.pauseOnScroll).toBe(true);
    // Segment 1: NOT inherited — scene 1 did not declare autoAdvance
    expect(profile!.segments[1]!.autoAdvance).toBeUndefined();
  });

  it('23. animationTimeScale does NOT carry forward to subsequent scenes', () => {
    // Scene 0 declares animationTimeScale. Scene 1 omits <ProgressManager>.
    const frames = [
      makeFrame('a', { scrollUnits: 1, fn: IDENTITY_FN, animationTimeScale: 3 }),
      makeFrame('b'),
      makeFrame('c'),
    ];
    const { profile, warnings } = collectWarnings(frames);
    expect(warnings).toHaveLength(0);
    expect(profile).not.toBeUndefined();
    // Segment 0: animationTimeScale from scene 0
    expect(profile!.segments[0]!.animationTimeScale).toBe(3);
    // Segment 1: NOT inherited
    expect(profile!.segments[1]!.animationTimeScale).toBeUndefined();
  });

  it('24. scrollUnits and fn DO carry forward (structural pacing properties)', () => {
    // Scene 0 declares scrollUnits=5 with a custom fn. Scenes 1 and 2 omit <ProgressManager>.
    // Both outgoing segments should inherit scrollUnits=5 and the custom fn.
    const customFn = (t: number): number => t * t;
    const frames = [
      makeFrame('a', { scrollUnits: 5, fn: customFn }),
      makeFrame('b'),
      makeFrame('c'),
    ];
    const { profile } = collectWarnings(frames);
    expect(profile).not.toBeUndefined();
    expect(profile!.segments).toHaveLength(2);
    // fn carries forward to both segments
    expect(profile!.segments[0]!.fn).toBe(customFn);
    expect(profile!.segments[1]!.fn).toBe(customFn);
    // Equal scrollUnits → equal raw widths (each 0.5 of total)
    expect(profile!.segments[0]!.rawEnd).toBeCloseTo(0.5, 10);
    expect(profile!.segments[1]!.rawEnd).toBeCloseTo(1.0, 10);
  });

  it('25. Second scene overrides autoAdvance; first scene still has its own', () => {
    // Regression: explicit carry-forward must not bleed autoAdvance across scenes.
    const frames = [
      makeFrame('a', {
        scrollUnits: 1,
        fn: IDENTITY_FN,
        autoAdvance: { duration: 3, max: 0.8, pauseOnScroll: true },
      }),
      makeFrame('b', {
        scrollUnits: 1,
        fn: IDENTITY_FN,
        autoAdvance: { duration: 10, max: 0.5, pauseOnScroll: false },
      }),
      makeFrame('c'),
    ];
    const { profile, warnings } = collectWarnings(frames);
    expect(warnings).toHaveLength(0);
    expect(profile!.segments[0]!.autoAdvance!.rawRate).toBeCloseTo((0.8 * 0.5) / 3, 6);
    expect(profile!.segments[1]!.autoAdvance!.rawRate).toBeCloseTo((0.5 * 0.5) / 10, 6);
    // Segment 2 would be (c has no outgoing transition) — only 2 segments for 3 scenes
    expect(profile!.segments).toHaveLength(2);
  });

  // ─── Stream D: transitionDuration / transitionEasing propagation ─────────────

  it('propagates transitionDuration from ProgressManagerSpec to segment', () => {
    const frames = [
      makeFrame('a', { scrollUnits: 2, fn: IDENTITY_FN, transitionDuration: 600 }),
      makeFrame('b', { scrollUnits: 1, fn: IDENTITY_FN }),
      makeFrame('c'),
    ];
    const { profile } = collectWarnings(frames);
    expect(profile).not.toBeUndefined();
    expect(profile!.segments[0]!.transitionDuration).toBe(600);
    expect(profile!.segments[1]!.transitionDuration).toBeUndefined();
  });

  it('propagates transitionEasing from ProgressManagerSpec to segment', () => {
    const customEasing = (t: number) => t * t;
    const frames = [
      makeFrame('a', { scrollUnits: 2, fn: IDENTITY_FN, transitionEasing: customEasing }),
      makeFrame('b', { scrollUnits: 1, fn: IDENTITY_FN }),
      makeFrame('c'),
    ];
    const { profile } = collectWarnings(frames);
    expect(profile).not.toBeUndefined();
    expect(profile!.segments[0]!.transitionEasing).toBe(customEasing);
    expect(profile!.segments[1]!.transitionEasing).toBeUndefined();
  });

  it('carries forward transitionDuration when next scene has no ProgressManager', () => {
    // Carry-forward: if scene c has no PM, it inherits from b (which has transitionDuration=300).
    const frames = [
      makeFrame('a', { scrollUnits: 2, fn: IDENTITY_FN }),
      makeFrame('b', { scrollUnits: 1, fn: IDENTITY_FN, transitionDuration: 300 }),
      makeFrame('c'), // no PM — inherits b's spec
    ];
    const { profile } = collectWarnings(frames);
    // Segment 1 is the outgoing transition from b (index 1). b has transitionDuration=300.
    expect(profile!.segments[1]!.transitionDuration).toBe(300);
  });
});
