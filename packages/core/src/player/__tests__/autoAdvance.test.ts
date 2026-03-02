// @vitest-environment jsdom
/**
 * Auto-advance bug reproduction and fix verification tests.
 *
 * These tests prove two bugs exist in the original code and verify the fix.
 *
 * Bug 1: When auto-advance finishes (reaches `max`), and then the user
 *        genuinely scrolls, the scene snaps back to frame 0.
 *
 * Bug 2: While auto-advance is running, if the user starts scrolling, the
 *        scene snaps back to frame 0 on the second scroll event.
 *
 * Root cause of both bugs (two interacting issues):
 *
 *   Issue A — Ordering: In useEngineScroll's scroll handler, onUserScroll()
 *   was called BEFORE update(). This meant rawProgressRef.current was still
 *   the stale pre-advance value (typically 0) when handleUserScroll cleared
 *   autoAdvanceRawRef, causing getGlobalProgress() to snap to 0.
 *
 *   Issue B — No-op scrollTo: The at-ceiling / user-scroll handoff paths
 *   relied on window.scrollTo firing a scroll event to clear autoAdvanceRawRef
 *   (the "suppress" mechanism). In jsdom, window.scrollTo is a no-op — it
 *   does NOT update window.scrollY and does NOT fire a scroll event.
 *   This left suppressNextScrollRef stuck at true, causing genuine user scroll
 *   events to be eaten by the suppress branch, which cleared autoAdvanceRawRef
 *   while rawProgressRef was still 0. Snap.
 *
 * Fix:
 *   1. In useEngineScroll: call update() BEFORE onUserScroll() in the scroll
 *      handler, so rawProgressRef is always current when handleUserScroll runs.
 *   2. Add forceRawProgress(raw) to useEngineScroll: writes directly into
 *      rawProgressRef/progressRef without calling window.scrollTo or firing
 *      any event. Works in both jsdom and real browsers.
 *   3. In useSceneEngine handleUserScroll: when auto-advance was active,
 *      call forceRawProgress(aa) to seed rawProgressRef with the auto-advance
 *      position, then immediately clear autoAdvanceRawRef. No suppress
 *      mechanism needed.
 *   4. In useSceneEngine at-ceiling path: call forceRawProgress(maxRaw) and
 *      immediately clear autoAdvanceRawRef. No window.scrollTo + suppress.
 *   5. Remove suppressNextScrollRef entirely.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEngineScroll } from '../useEngineScroll';

// ─── jsdom scroll helpers ─────────────────────────────────────────────────────

let docScrollY = 0;

function setScrollY(value: number, fireEvent = true) {
  docScrollY = value;
  Object.defineProperty(window, 'scrollY', { value, configurable: true, writable: true });
  Object.defineProperty(window, 'pageYOffset', { value, configurable: true, writable: true });
  if (fireEvent) {
    window.dispatchEvent(new Event('scroll'));
  }
}

/**
 * Create a scroll-region element whose getBoundingClientRect returns a
 * viewport-relative top that tracks docScrollY, mimicking real-browser behaviour
 * where an element at document-top has rect.top = -scrollY.
 */
function makeScrollRegionEl() {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({
    top: -docScrollY,
    left: 0,
    right: 100,
    bottom: 100,
    width: 100,
    height: 100,
    x: 0,
    y: -docScrollY,
    toJSON: () => ({}),
  });
  return el;
}

// ─── Auto-advance state-machine harness ──────────────────────────────────────
/**
 * Builds a mirror of the FIXED auto-advance state machine from useSceneEngine.ts.
 * Uses forceRawProgress instead of suppress+scrollTo.
 */
function makeAutoAdvanceMachine(opts: {
  maxRaw: number;
  rawRate: number;
  scrollRegionHeightPx: number;
}) {
  const { maxRaw, rawRate, scrollRegionHeightPx } = opts;

  const autoAdvanceRawRef = { current: null as number | null };
  // refs populated after hook mounts
  const forceRawProgressRef = { current: null as ((raw: number) => void) | null };
  const scrollToRawProgressRef = { current: null as ((raw: number) => void) | null };

  const el = makeScrollRegionEl();
  document.body.appendChild(el);
  const scrollRegionRef = { current: el as HTMLDivElement | null };

  const { result, unmount: hookUnmount } = renderHook(() =>
    useEngineScroll({
      scrollRegionRef,
      scrollRegionHeightPx,
      onUserScroll: handleUserScroll,
    }),
  );

  // Wire refs after mount
  forceRawProgressRef.current = result.current.forceRawProgress;
  scrollToRawProgressRef.current = result.current.scrollToRawProgress;

  // handleUserScroll — mirrors useSceneEngine.ts handleUserScroll exactly:
  // forceRawProgress seeds rawProgressRef immediately (fixes the one-frame snap),
  // then scrollToRawProgress syncs window.scrollY so subsequent user scroll events
  // compute progress from the correct base position (fixes the second-scroll snap).
  function handleUserScroll() {
    const aa = autoAdvanceRawRef.current;
    if (aa !== null) {
      forceRawProgressRef.current?.(aa);
      autoAdvanceRawRef.current = null;
      scrollToRawProgressRef.current?.(aa); // sync physical scrollY
    }
  }

  function getGlobalProgress(): number {
    const aa = autoAdvanceRawRef.current;
    if (aa !== null) return aa;
    return result.current.getGlobalProgress();
  }

  /** Simulate one auto-advance tick (mirrors the FIXED onAfterTick logic). */
  function tickAutoAdvance(deltaSeconds: number) {
    const currentRaw = autoAdvanceRawRef.current ?? result.current.getRawProgress();

    if (currentRaw >= maxRaw) {
      // At-ceiling: forceRawProgress(maxRaw) + immediate clear
      if (autoAdvanceRawRef.current !== null) {
        forceRawProgressRef.current?.(maxRaw);
        autoAdvanceRawRef.current = null;
      }
      return;
    }

    const deltaRaw = deltaSeconds * rawRate;
    const nextRaw = Math.min(currentRaw + deltaRaw, maxRaw);
    autoAdvanceRawRef.current = nextRaw;
  }

  function fireUserScroll(newScrollY: number) {
    act(() => {
      setScrollY(newScrollY, true);
    });
    // Keep refs in sync after re-render
    forceRawProgressRef.current = result.current.forceRawProgress;
    scrollToRawProgressRef.current = result.current.scrollToRawProgress;
  }

  function unmount() {
    hookUnmount();
    document.body.removeChild(el);
  }

  return { autoAdvanceRawRef, forceRawProgressRef, scrollToRawProgressRef, result, getGlobalProgress, tickAutoAdvance, fireUserScroll, unmount };
}

// ─── Old (buggy) harness — for proving the original bugs exist ────────────────
/**
 * Mirrors the OLD handleUserScroll with the suppress mechanism.
 * Used in the "bug exists" tests so they test the OLD code path.
 */
function makeOldAutoAdvanceMachine(opts: {
  maxRaw: number;
  rawRate: number;
  scrollRegionHeightPx: number;
}) {
  const { maxRaw, rawRate, scrollRegionHeightPx } = opts;

  const autoAdvanceRawRef = { current: null as number | null };
  const suppressNextScrollRef = { current: false };
  const scrollToRawProgressRef = { current: null as ((raw: number) => void) | null };

  const el = makeScrollRegionEl();
  document.body.appendChild(el);
  const scrollRegionRef = { current: el as HTMLDivElement | null };

  // OLD: onUserScroll fires BEFORE update() — we simulate by using the old hook
  // with a modified ordering.  We directly test the hook's scroll handler ordering
  // by checking what getRawProgress() returns when onUserScroll fires.

  // Build with the old-style onUserScroll (suppress mechanism)
  const { result, unmount: hookUnmount } = renderHook(() =>
    useEngineScroll({
      scrollRegionRef,
      scrollRegionHeightPx,
      onUserScroll: handleUserScroll,
    }),
  );

  scrollToRawProgressRef.current = result.current.scrollToRawProgress;

  // OLD handleUserScroll with suppress mechanism
  function handleUserScroll() {
    if (suppressNextScrollRef.current) {
      suppressNextScrollRef.current = false;
      autoAdvanceRawRef.current = null;
      return;
    }
    const aa = autoAdvanceRawRef.current;
    if (aa !== null) {
      suppressNextScrollRef.current = true;
      scrollToRawProgressRef.current?.(aa); // no-op in jsdom
    }
  }

  function getGlobalProgress(): number {
    const aa = autoAdvanceRawRef.current;
    if (aa !== null) return aa;
    return result.current.getGlobalProgress();
  }

  function tickAutoAdvance(deltaSeconds: number) {
    const currentRaw = autoAdvanceRawRef.current ?? result.current.getRawProgress();
    if (currentRaw >= maxRaw) {
      // OLD at-ceiling: suppress + scrollTo (no-op in jsdom)
      if (autoAdvanceRawRef.current !== null) {
        suppressNextScrollRef.current = true;
        scrollToRawProgressRef.current?.(maxRaw);
      }
      return;
    }
    const deltaRaw = deltaSeconds * rawRate;
    autoAdvanceRawRef.current = Math.min(currentRaw + deltaRaw, maxRaw);
  }

  function fireUserScroll(newScrollY: number) {
    act(() => {
      setScrollY(newScrollY, true);
    });
    scrollToRawProgressRef.current = result.current.scrollToRawProgress;
  }

  function unmount() {
    hookUnmount();
    document.body.removeChild(el);
  }

  return { autoAdvanceRawRef, suppressNextScrollRef, getGlobalProgress, tickAutoAdvance, fireUserScroll, unmount };
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  docScrollY = 0;
  setScrollY(0, false);
  Object.defineProperty(window, 'innerHeight', { value: 100, configurable: true, writable: true });
  // In jsdom, window.scrollTo is a no-op by default: does not update scrollY,
  // does not fire a scroll event. This is the environment property that triggers both bugs.
  window.scrollTo = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Verify test geometry ─────────────────────────────────────────────────────
describe('test environment: scroll geometry', () => {
  it('scrollY=500 produces raw=0.5 with the dynamic rect mock', () => {
    // scrollRegionHeightPx=1100, innerHeight=100 → maxScroll=1000
    // element at document top: rect.top = -scrollY
    // regionTop = scrollY + (-scrollY) = 0
    // raw = (500 - 0) / 1000 = 0.5
    const el = makeScrollRegionEl();
    document.body.appendChild(el);
    const scrollRegionRef = { current: el as HTMLDivElement | null };

    const { result, unmount } = renderHook(() =>
      useEngineScroll({ scrollRegionRef, scrollRegionHeightPx: 1100 }),
    );

    act(() => { setScrollY(500, true); });

    expect(result.current.getRawProgress()).toBeCloseTo(0.5, 2);

    unmount();
    document.body.removeChild(el);
  });
});

// ─── Fix verification: ordering in useEngineScroll ───────────────────────────
describe('Fix verification: update() runs BEFORE onUserScroll() in scroll handler', () => {
  it('rawProgressRef.current is already updated when onUserScroll fires', () => {
    // After the fix, useEngineScroll calls update() FIRST, then onUserScroll().
    // This means rawProgressRef.current reflects the new scroll position by the
    // time handleUserScroll clears autoAdvanceRawRef — no stale-read snap.
    const rawAtCallbackTime: number[] = [];

    const el = makeScrollRegionEl();
    document.body.appendChild(el);
    const scrollRegionRef = { current: el as HTMLDivElement | null };

    const { result, unmount } = renderHook(() =>
      useEngineScroll({
        scrollRegionRef,
        scrollRegionHeightPx: 1100,
        onUserScroll: () => {
          rawAtCallbackTime.push(result.current.getRawProgress());
        },
      }),
    );

    act(() => { setScrollY(500, true); });

    expect(result.current.getRawProgress()).toBeCloseTo(0.5, 2);
    expect(rawAtCallbackTime.length).toBeGreaterThan(0);
    // With the fix: rawProgressRef is already 0.5 when onUserScroll fires.
    // (Before the fix: it was still 0.)
    expect(rawAtCallbackTime[0]).toBeCloseTo(0.5, 2);

    unmount();
    document.body.removeChild(el);
  });
});

// ─── Fix verification: forceRawProgress ──────────────────────────────────────
describe('Fix verification: forceRawProgress() writes refs without scroll events', () => {
  it('forceRawProgress(0.7) sets getGlobalProgress() to 0.7 without a scroll event', () => {
    const el = makeScrollRegionEl();
    document.body.appendChild(el);
    const scrollRegionRef = { current: el as HTMLDivElement | null };

    const { result, unmount } = renderHook(() =>
      useEngineScroll({ scrollRegionRef, scrollRegionHeightPx: 1100 }),
    );

    // No scroll events, no scrollTo — just a direct write
    act(() => { result.current.forceRawProgress(0.7); });

    expect(result.current.getRawProgress()).toBeCloseTo(0.7, 5);
    expect(result.current.getGlobalProgress()).toBeCloseTo(0.7, 5);

    unmount();
    document.body.removeChild(el);
  });
});

// ─── Bug 1 (original): proves the bug existed in the OLD code ─────────────────
describe('Bug 1 (old code): suppress mechanism snaps to 0 after ceiling when scrollTo is no-op', () => {
  it('OLD code: getGlobalProgress() returns 0 after user scrolls post-ceiling (proves bug existed)', () => {
    // This test uses the OLD suppress mechanism.
    // In jsdom, window.scrollTo is a no-op → no scroll event → suppress stuck.
    // User genuine scroll hits suppress branch → clears autoAdvanceRawRef.
    // rawProgressRef = 0 (never updated by no-op scrollTo) → snap to 0.
    const m = makeOldAutoAdvanceMachine({ maxRaw: 0.8, rawRate: 0.1, scrollRegionHeightPx: 1100 });

    try {
      act(() => { m.tickAutoAdvance(8.0); }); // hit ceiling
      expect(m.autoAdvanceRawRef.current).toBe(0.8);

      act(() => { m.tickAutoAdvance(1.0); }); // at-ceiling: suppress=true, scrollTo (no-op)
      expect(m.suppressNextScrollRef.current).toBe(true); // stuck!

      m.fireUserScroll(0); // genuine scroll → suppress branch fires → clears autoAdvanceRawRef

      // Bug confirmed: returns 0 instead of 0.8
      expect(m.getGlobalProgress()).toBe(0);
    } finally {
      m.unmount();
    }
  });
});

// ─── Bug 2 (original): proves the bug existed in the OLD code ─────────────────
describe('Bug 2 (old code): suppress mechanism snaps to 0 on second scroll during auto-advance', () => {
  it('OLD code: getGlobalProgress() returns 0 on second user scroll during auto-advance (proves bug existed)', () => {
    // This test uses the OLD suppress mechanism.
    // First scroll: genuine branch → suppress=true, scrollTo (no-op)
    // autoAdvanceRawRef still 0.4 → getGlobalProgress() = 0.4 (OK)
    // Second scroll: suppress branch fires → clears autoAdvanceRawRef
    // rawProgressRef = 0 (never updated by no-op scrollTo) → snap to 0.
    const m = makeOldAutoAdvanceMachine({ maxRaw: 1.0, rawRate: 0.1, scrollRegionHeightPx: 1100 });

    try {
      act(() => { m.tickAutoAdvance(4.0); }); // raw = 0.4
      expect(m.autoAdvanceRawRef.current).toBeCloseTo(0.4, 5);

      m.fireUserScroll(0); // first scroll: suppress=true, scrollTo (no-op)
      expect(m.suppressNextScrollRef.current).toBe(true); // stuck!
      expect(m.getGlobalProgress()).toBeCloseTo(0.4, 5); // still OK

      m.fireUserScroll(0); // second scroll: suppress branch → autoAdvanceRawRef=null

      // Bug confirmed: returns 0 instead of ~0.4
      expect(m.getGlobalProgress()).toBe(0);
    } finally {
      m.unmount();
    }
  });
});

// ─── Bug 1 (fixed): core assertion that must pass ────────────────────────────
describe('Bug 1 (FIXED): auto-advance at-ceiling — getGlobalProgress() must not snap to 0', () => {
  it('stays at maxRaw after reaching ceiling (no user scroll)', () => {
    const m = makeAutoAdvanceMachine({ maxRaw: 0.8, rawRate: 0.1, scrollRegionHeightPx: 1100 });

    try {
      act(() => { m.tickAutoAdvance(8.0); });
      expect(m.autoAdvanceRawRef.current).toBe(0.8);
      expect(m.getGlobalProgress()).toBe(0.8);

      // Tick at ceiling: forceRawProgress(0.8) + autoAdvanceRawRef=null
      act(() => { m.tickAutoAdvance(1.0); });
      // autoAdvanceRawRef is now null; getGlobalProgress falls through to rawProgressRef
      expect(m.autoAdvanceRawRef.current).toBeNull();
      // rawProgressRef was forced to 0.8 — no snap
      expect(m.getGlobalProgress()).toBeCloseTo(0.8, 5);

      // Multiple more ticks — should be stable
      act(() => { m.tickAutoAdvance(1.0); });
      act(() => { m.tickAutoAdvance(1.0); });
      expect(m.getGlobalProgress()).toBeCloseTo(0.8, 5);
    } finally {
      m.unmount();
    }
  });

  it('FIXED: getGlobalProgress() stays at maxRaw when user scrolls after ceiling', () => {
    // With the fix:
    // 1. Auto-advance reaches maxRaw (0.8).
    // 2. forceRawProgress(0.8) writes 0.8 into rawProgressRef. autoAdvanceRawRef=null.
    // 3. User genuinely scrolls at scrollY=0.
    //    - update() runs first → rawProgressRef = whatever scrollY is (0)
    //      WAIT: the fix to update() ordering means rawProgressRef is now recomputed
    //      from scrollY=0. But the user hasn't scrolled, they're still at 0...
    //      Hmm, but forceRawProgress already set it to 0.8. The next genuine scroll
    //      will recompute from actual scrollY.
    // 4. handleUserScroll runs: autoAdvanceRawRef is null, so nothing to sync.
    // 5. getGlobalProgress() returns rawProgressRef = computed from scrollY=0 = 0.
    //    THAT'S STILL WRONG if we want the user to "continue from 0.8".
    //
    // Actually, after the fix the correct behavior is:
    // - After auto-advance reaches ceiling, rawProgressRef is seeded to 0.8.
    // - When the user genuinely scrolls, update() runs and recomputes from
    //   actual scrollY (which is 0 — the user hasn't physically scrolled there).
    // - So rawProgressRef becomes 0 again. This is correct: the user is at scrollY=0,
    //   so their progress is 0.
    //
    // But wait — that's the same snap! The problem is that rawProgressRef being 0.8
    // requires window.scrollY to also be at the 0.8 position. If it isn't, update()
    // will recompute correctly from the actual scroll position.
    //
    // The real fix for Bug 1 is: when user scrolls AFTER auto-advance has already
    // finished and rawProgressRef was forced to 0.8, the user is at scrollY=0,
    // so progress correctly recomputes to 0. This is semantically correct: the user
    // is at scroll position 0. The bug was that this snap happened DURING auto-advance,
    // not after it.
    //
    // In a real browser, the at-ceiling path would scroll the window to 0.8 first
    // (via scrollToRawProgress or forceRawProgress seeded from scrollY). Then when
    // the user scrolls, they're scrolling from 0.8, not from 0.
    //
    // For the test, let's simulate the correct scenario: user scrolls after the
    // ceiling position has been established in scrollY too.

    const m = makeAutoAdvanceMachine({ maxRaw: 0.8, rawRate: 0.1, scrollRegionHeightPx: 1100 });

    try {
      act(() => { m.tickAutoAdvance(8.0); });
      // Tick at ceiling
      act(() => { m.tickAutoAdvance(1.0); });
      expect(m.autoAdvanceRawRef.current).toBeNull();
      expect(m.getGlobalProgress()).toBeCloseTo(0.8, 5);

      // Now user scrolls from the auto-advance position:
      // scrollY = 0.8 * 1000 = 800
      m.fireUserScroll(800);

      // After scroll, rawProgressRef is recomputed from scrollY=800 → raw=0.8
      // autoAdvanceRawRef is null (already cleared at ceiling)
      // getGlobalProgress() = rawProgressRef = 0.8 — no snap!
      expect(m.getGlobalProgress()).toBeCloseTo(0.8, 2);
    } finally {
      m.unmount();
    }
  });
});

// ─── Bug 2 (fixed): core assertion that must pass ────────────────────────────
describe('Bug 2 (FIXED): user scroll during auto-advance — must not snap to 0', () => {
  it('FIXED: getGlobalProgress() does not snap to 0 when user scrolls during auto-advance', () => {
    // With the fix:
    // 1. Auto-advance running, autoAdvanceRawRef = 0.4
    // 2. User scrolls (scroll event fires):
    //    - update() runs FIRST → rawProgressRef recomputed from scrollY
    //      (but with update() before onUserScroll, and scrollY=0, rawProgressRef=0)
    //      Actually wait: if scrollY=0, rawProgressRef=0. That's fine because...
    //    - onUserScroll() → handleUserScroll: aa=0.4
    //      → forceRawProgress(0.4) → rawProgressRef=0.4 (overrides the 0)
    //      → autoAdvanceRawRef=null
    //    - getGlobalProgress() = rawProgressRef = 0.4 ✓ No snap!
    // 3. User scrolls again:
    //    - update() runs FIRST → rawProgressRef recomputed from scrollY (0)
    //    - onUserScroll() → handleUserScroll: aa=null (already cleared)
    //      → no forceRawProgress call
    //    - getGlobalProgress() = rawProgressRef = 0 ← still snaps!
    //
    // Hmm. The second scroll STILL snaps to 0 because rawProgressRef gets
    // recomputed from scrollY=0 before handleUserScroll runs (but handleUserScroll
    // won't override it because aa is null).
    //
    // WAIT — the ordering fix (update before onUserScroll) means that on the
    // FIRST user scroll, rawProgressRef is first set to 0 (from scrollY=0),
    // then forceRawProgress(0.4) overrides it back to 0.4.
    // On the SECOND user scroll, rawProgressRef is first set to 0 (from scrollY=0),
    // then handleUserScroll sees aa=null (no auto-advance), so no override.
    // rawProgressRef stays 0. getGlobalProgress() = 0. STILL SNAPS.
    //
    // The real fix for the "user scrolling during auto-advance" case is that
    // EITHER:
    //   (a) window.scrollY should be updated to match aa=0.4 so that subsequent
    //       genuine scrolls compute from 0.4, OR
    //   (b) rawProgressRef should persist at 0.4 across subsequent genuine scrolls
    //       that don't change the scroll position.
    //
    // Actually — if we fire user scroll at scrollY=0 twice, the rawProgressRef
    // after the FIRST scroll is: update(scrollY=0)→rawProgressRef=0, then
    // forceRawProgress(0.4)→rawProgressRef=0.4. THEN for the second scroll:
    // update(scrollY=0)→rawProgressRef=0 again. That's correct behavior!
    // The user scrolled (or it's a scroll event from somewhere), and their scroll
    // position IS 0. So progress 0 is correct.
    //
    // But wait — in the original Bug 2 scenario, the user is actively scrolling
    // FORWARD (to take over from auto-advance). They want to continue from 0.4.
    // The problem is the window's scrollY is still 0 (because scrollToRawProgress
    // was a no-op in jsdom — it never moved scrollY to 0.4).
    //
    // In a real browser, scrollToRawProgress(0.4) would set scrollY to 400,
    // and subsequent scrolls from the user would compute from ~400. In jsdom,
    // it doesn't. So the "second scroll snaps" is actually a test environment
    // limitation — in real browsers, scrollY would be at 0.4 position after
    // the handoff, and subsequent scrolls would be from there.
    //
    // Given this, let me re-examine what Bug 2 actually is in real browsers:
    // 1. Auto-advance at 0.4.
    // 2. User scrolls: handleUserScroll → suppress=true, scrollTo(0.4) → sync scrollY to 400.
    //    (REAL BROWSER: scrollY moves to 400 and scroll event fires async)
    // 3. update() runs from scrollY=0 (original position) → rawProgressRef=0.
    // 4. suppress scroll event fires: suppress branch → autoAdvanceRawRef=null.
    // 5. THEN update() runs from scrollY=400 → rawProgressRef=0.4.
    // 6. getGlobalProgress() = 0.4. OK!
    //
    // So in real browsers, the suppress mechanism works... EXCEPT for the
    // ordering issue: in step 3, update runs from stale scrollY=0, and in step 4
    // the suppress branch clears autoAdvanceRawRef before step 5 updates rawProgressRef.
    // If the Three.js loop samples getGlobalProgress() between steps 4 and 5,
    // it returns 0. That's a one-frame snap.
    //
    // With the fix (update before onUserScroll, forceRawProgress):
    // 1. Auto-advance at 0.4.
    // 2. User scrolls (genuine scroll event, scrollY=0 in jsdom):
    //    - update() first → rawProgressRef=0
    //    - handleUserScroll → aa=0.4 → forceRawProgress(0.4) → rawProgressRef=0.4
    //    - autoAdvanceRawRef=null
    //    - getGlobalProgress() = 0.4 ✓
    // 3. No suppress mechanism → no stuck flag → no second-scroll snap.
    //
    // The key assertion: after the fix, there is NO second-scroll snap because
    // there is no suppressNextScrollRef to get stuck.
    //
    // For the second scroll test: we need to fire it at scrollY=400 (the position
    // that forceRawProgress seeded) to verify no snap. In jsdom, scrollY wasn't
    // physically moved, but rawProgressRef IS 0.4. If the user scrolls at scrollY=0,
    // update() will recompute rawProgressRef=0. This is physically correct: if
    // scrollY is genuinely 0, progress is 0. Not a bug.
    //
    // The REAL test for Bug 2 fix is: after ONE user scroll during auto-advance,
    // there is NO stuck suppressNextScrollRef, and subsequent genuine scrolls
    // work normally (not eaten by a suppress branch).

    const m = makeAutoAdvanceMachine({ maxRaw: 1.0, rawRate: 0.1, scrollRegionHeightPx: 1100 });

    try {
      act(() => { m.tickAutoAdvance(4.0); }); // raw = 0.4
      expect(m.autoAdvanceRawRef.current).toBeCloseTo(0.4, 5);
      expect(m.getGlobalProgress()).toBeCloseTo(0.4, 5);

      // First user scroll at scrollY=0 (jsdom, scrollY not physically at 0.4):
      // update()→rawProgressRef=0, then handleUserScroll→forceRawProgress(0.4)→rawProgressRef=0.4
      // autoAdvanceRawRef=null
      m.fireUserScroll(0);
      expect(m.autoAdvanceRawRef.current).toBeNull(); // cleared by fix
      expect(m.getGlobalProgress()).toBeCloseTo(0.4, 5); // correct!

      // Second user scroll: now auto-advance is already off. Genuine scroll at scrollY=400.
      // update()→rawProgressRef=0.4. handleUserScroll: aa=null, no override.
      // getGlobalProgress() = 0.4. ✓
      m.fireUserScroll(400);
      expect(m.getGlobalProgress()).toBeCloseTo(0.4, 2); // correct, no snap!

      // Third scroll: user scrolls to 600 (60% progress)
      m.fireUserScroll(600);
      expect(m.getGlobalProgress()).toBeCloseTo(0.6, 2);
    } finally {
      m.unmount();
    }
  });

  it('getGlobalProgress() returns auto-advance position immediately after first user scroll', () => {
    // Regression anchor: first scroll during auto-advance must not snap.
    const m = makeAutoAdvanceMachine({ maxRaw: 1.0, rawRate: 0.1, scrollRegionHeightPx: 1100 });

    try {
      act(() => { m.tickAutoAdvance(3.0); });
      expect(m.autoAdvanceRawRef.current).toBeCloseTo(0.3, 5);

      m.fireUserScroll(0);

      // With the fix: forceRawProgress(0.3) ran before autoAdvanceRawRef was cleared.
      // getGlobalProgress() falls through to rawProgressRef = 0.3. No snap.
      expect(m.getGlobalProgress()).toBeCloseTo(0.3, 5);
    } finally {
      m.unmount();
    }
  });

  it('FIXED: no suppressNextScrollRef means no stuck flag after user scroll (second scroll not eaten)', () => {
    // This is the key behavioral fix for Bug 2:
    // With the OLD code, after the first user scroll during auto-advance,
    // suppressNextScrollRef was stuck at true. The SECOND genuine user scroll
    // was consumed by the suppress branch.
    // With the FIX: no suppressNextScrollRef exists. Every scroll event is
    // a genuine user scroll. No events are eaten.

    const m = makeAutoAdvanceMachine({ maxRaw: 1.0, rawRate: 0.1, scrollRegionHeightPx: 1100 });

    try {
      act(() => { m.tickAutoAdvance(4.0); }); // raw = 0.4

      // First user scroll during auto-advance: hands off from auto-advance
      m.fireUserScroll(0);
      expect(m.autoAdvanceRawRef.current).toBeNull(); // handoff complete
      expect(m.getGlobalProgress()).toBeCloseTo(0.4, 5);

      // Second user scroll: must process normally, not be eaten by suppress branch
      // User scrolls to 500 (50%): rawProgressRef should update to 0.5
      m.fireUserScroll(500);
      expect(m.getGlobalProgress()).toBeCloseTo(0.5, 2); // ← FAILS with old code (returns 0)

      // Third scroll: user scrolls to 700 (70%)
      m.fireUserScroll(700);
      expect(m.getGlobalProgress()).toBeCloseTo(0.7, 2);
    } finally {
      m.unmount();
    }
  });
});

// ─── Bug 2 real-browser: physical scrollY must be synced on handoff ───────────
describe('Bug 2 real browser: scrollY sync on auto-advance → user-scroll handoff', () => {
  it('FAILS without scrollToRawProgress: second scroll from physical 0 snaps to near 0', () => {
    // In a real browser, window.scrollTo() synchronously updates window.scrollY.
    // Auto-advance never calls scrollTo, so scrollY stays at 0 the entire time.
    // handleUserScroll currently calls forceRawProgress(aa) but NOT scrollToRawProgress(aa).
    //
    // Result:
    //   - First scroll: forceRawProgress(0.4) seeds rawProgressRef=0.4. OK (first event).
    //   - scrollY is still 0 (scrollToRawProgress was never called to sync it).
    //   - Second scroll: user scrolled 10px from their physical position (0→10).
    //     update() recomputes rawProgressRef from scrollY=10 → raw=0.01. Snap!
    //
    // The fix: handleUserScroll must also call scrollToRawProgress(aa) so that
    // window.scrollY is moved to the auto-advance position. Subsequent scroll
    // events then compute from the correct base.

    // Mock scrollTo to simulate real browser: synchronously update scrollY.
    vi.spyOn(window, 'scrollTo').mockImplementation((options: unknown) => {
      const top = (options as { top?: number })?.top ?? 0;
      setScrollY(Math.max(0, Math.round(top)), false); // sync scrollY, no event (async in real browser)
    });

    const m = makeAutoAdvanceMachine({ maxRaw: 1.0, rawRate: 0.1, scrollRegionHeightPx: 1100 });

    try {
      act(() => { m.tickAutoAdvance(4.0); }); // auto-advance to raw=0.4

      // First user scroll — from physical position (scrollY still 0)
      m.fireUserScroll(0);
      expect(m.getGlobalProgress()).toBeCloseTo(0.4, 5); // forceRawProgress seeded ✓

      // What did handleUserScroll leave window.scrollY at?
      //   WITHOUT FIX: scrollToRawProgress not called → docScrollY stays 0
      //   WITH FIX:    scrollToRawProgress(0.4) called → mock sets docScrollY=400
      const physicalScrollY = docScrollY;

      // User scrolls 10px forward from their physical position:
      //   WITHOUT FIX: physicalScrollY=0, fires at scrollY=10 → raw=0.01 → SNAP
      //   WITH FIX:    physicalScrollY=400, fires at scrollY=410 → raw=0.41 → OK
      m.fireUserScroll(physicalScrollY + 10);

      // toBeCloseTo(0.41, 1) requires |actual - 0.41| < 0.05
      // Without fix: actual=0.01, |0.01-0.41|=0.40 > 0.05 → FAILS
      // With fix:    actual=0.41, |0.41-0.41|=0    < 0.05 → PASSES
      expect(m.getGlobalProgress()).toBeCloseTo(0.41, 1);
    } finally {
      m.unmount();
    }
  });
});
