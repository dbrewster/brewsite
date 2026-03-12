import { describe, it, expect } from 'vitest';
import { resolveStackLayout, resolveCarouselLayout, resolveLoopCarouselLayout } from '../regionLayout';
import type { NVSRect } from '../types';

const container: NVSRect = { x: 0, y: 0, w: 1, h: 1 };

describe('resolveStackLayout', () => {
  it('distributes 2 equal-width views horizontally with no gap', () => {
    const results = resolveStackLayout(
      { kind: 'stack', direction: 'horizontal' },
      container,
      [{ w: 0, h: 0 }, { w: 0, h: 0 }],
    );
    expect(results).toHaveLength(2);
    expect(results[0].bounds).toEqual({ x: 0, y: 0, w: 0.5, h: 1 });
    expect(results[1].bounds).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 });
    expect(results[0].layer).toBe(0);
    expect(results[0].scale).toBe(1.0);
  });

  it('places 3 views with explicit widths horizontally with gap', () => {
    const results = resolveStackLayout(
      { kind: 'stack', direction: 'horizontal', gap: 0.02 },
      container,
      [{ w: 0.3, h: 1 }, { w: 0.4, h: 1 }, { w: 0.24, h: 1 }],
    );
    expect(results).toHaveLength(3);
    expect(results[0].bounds.x).toBeCloseTo(0);
    expect(results[0].bounds.w).toBeCloseTo(0.3);
    expect(results[1].bounds.x).toBeCloseTo(0.32);
    expect(results[1].bounds.w).toBeCloseTo(0.4);
    expect(results[2].bounds.x).toBeCloseTo(0.74);
    expect(results[2].bounds.w).toBeCloseTo(0.24);
  });

  it('stacks 2 views vertically', () => {
    const results = resolveStackLayout(
      { kind: 'stack', direction: 'vertical' },
      container,
      [{ w: 0, h: 0 }, { w: 0, h: 0 }],
    );
    expect(results).toHaveLength(2);
    expect(results[0].bounds).toEqual({ x: 0, y: 0, w: 1, h: 0.5 });
    expect(results[1].bounds).toEqual({ x: 0, y: 0.5, w: 1, h: 0.5 });
  });

  it('single view occupies the full container', () => {
    const results = resolveStackLayout(
      { kind: 'stack' },
      container,
      [{ w: 0, h: 0 }],
    );
    expect(results).toHaveLength(1);
    expect(results[0].bounds).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('returns empty array for 0 views', () => {
    const results = resolveStackLayout({ kind: 'stack' }, container, []);
    expect(results).toHaveLength(0);
  });
});

describe('resolveCarouselLayout', () => {
  const uniformHints = [
    { w: 0.6, h: 0.8 },
    { w: 0.6, h: 0.8 },
    { w: 0.6, h: 0.8 },
  ];

  it('centers the first view when activeIndex=0, others offset to the right', () => {
    const results = resolveCarouselLayout(
      { kind: 'carousel', activeIndex: 0 },
      container,
      uniformHints,
    );
    expect(results).toHaveLength(3);
    // Active (i=0) is centered
    expect(results[0].scale).toBe(1.0);
    expect(results[0].bounds.x).toBeCloseTo(0.5 - 0.3); // center - half active width
    // i=1 is to the right, scale = 0.75
    expect(results[1].scale).toBeCloseTo(0.75);
    expect(results[1].bounds.x).toBeGreaterThan(results[0].bounds.x + results[0].bounds.w);
    // i=2 is further right, scale = 0.75^2
    expect(results[2].scale).toBeCloseTo(0.75 ** 2);
    expect(results[2].bounds.x).toBeGreaterThan(results[1].bounds.x + results[1].bounds.w);
  });

  it('centers the middle view when activeIndex=1, flanking views at inactiveScale', () => {
    const results = resolveCarouselLayout(
      { kind: 'carousel', activeIndex: 1 },
      container,
      uniformHints,
    );
    expect(results[1].scale).toBe(1.0);
    expect(results[0].scale).toBeCloseTo(0.75);
    expect(results[2].scale).toBeCloseTo(0.75);
    // Middle view is centered
    const midCenter = results[1].bounds.x + results[1].bounds.w / 2;
    expect(midCenter).toBeCloseTo(0.5);
    // Flanking views are symmetric around center
    const left0Center = results[0].bounds.x + results[0].bounds.w / 2;
    const right2Center = results[2].bounds.x + results[2].bounds.w / 2;
    expect(Math.abs((0.5 - left0Center) - (right2Center - 0.5))).toBeCloseTo(0);
  });

  it('produces symmetric arrangement for 5 views with activeIndex=2', () => {
    const hints5 = Array(5).fill({ w: 0.4, h: 0.6 });
    const results = resolveCarouselLayout(
      { kind: 'carousel', activeIndex: 2 },
      container,
      hints5,
    );
    expect(results).toHaveLength(5);
    // Active (i=2) is centered
    const activeCenter = results[2].bounds.x + results[2].bounds.w / 2;
    expect(activeCenter).toBeCloseTo(0.5);
    // Symmetric pairs: (0,4) and (1,3)
    const center0 = results[0].bounds.x + results[0].bounds.w / 2;
    const center4 = results[4].bounds.x + results[4].bounds.w / 2;
    expect(Math.abs((0.5 - center0) - (center4 - 0.5))).toBeCloseTo(0);
    const center1 = results[1].bounds.x + results[1].bounds.w / 2;
    const center3 = results[3].bounds.x + results[3].bounds.w / 2;
    expect(Math.abs((0.5 - center1) - (center3 - 0.5))).toBeCloseTo(0);
    // Cumulative scale reduction
    expect(results[2].scale).toBe(1.0);
    expect(results[1].scale).toBeCloseTo(0.75);
    expect(results[3].scale).toBeCloseTo(0.75);
    expect(results[0].scale).toBeCloseTo(0.75 ** 2);
    expect(results[4].scale).toBeCloseTo(0.75 ** 2);
  });

  it('clamps out-of-range activeIndex to valid range', () => {
    // activeIndex = -1 → clamp to 0
    const resultsLow = resolveCarouselLayout(
      { kind: 'carousel', activeIndex: -1 },
      container,
      uniformHints,
    );
    expect(resultsLow[0].scale).toBe(1.0);
    expect(resultsLow[1].scale).toBeCloseTo(0.75);

    // activeIndex = 99 → clamp to N-1
    const resultsHigh = resolveCarouselLayout(
      { kind: 'carousel', activeIndex: 99 },
      container,
      uniformHints,
    );
    expect(resultsHigh[2].scale).toBe(1.0);
    expect(resultsHigh[1].scale).toBeCloseTo(0.75);
  });

  it('assigns layer correctly: active = N, adjacent = N-1, etc.', () => {
    const results = resolveCarouselLayout(
      { kind: 'carousel', activeIndex: 1 },
      container,
      uniformHints,
    );
    // N = 3, active (i=1) gets layer 3, flanking (distance=1) get layer 2
    expect(results[1].layer).toBe(3);
    expect(results[0].layer).toBe(2);
    expect(results[2].layer).toBe(2);
  });

  it('uses default gap, inactiveScale, and zStep when not specified', () => {
    // Default inactiveScale = 0.75, gap = 0.04
    const results = resolveCarouselLayout(
      { kind: 'carousel', activeIndex: 0 },
      container,
      [{ w: 0.4, h: 0.6 }, { w: 0.4, h: 0.6 }],
    );
    expect(results[1].scale).toBeCloseTo(0.75);
    // Gap between active right edge and view 1 left edge should be 0.04
    const activeRight = results[0].bounds.x + results[0].bounds.w;
    const view1Left = results[1].bounds.x;
    expect(view1Left - activeRight).toBeCloseTo(0.04);
  });

  it('single view occupies full container regardless of activeIndex', () => {
    const results = resolveCarouselLayout(
      { kind: 'carousel', activeIndex: 5 },
      container,
      [{ w: 0.8, h: 0.9 }],
    );
    expect(results).toHaveLength(1);
    expect(results[0].scale).toBe(1.0);
    expect(results[0].layer).toBe(1);
    // Single view is centered in container
    const cx = results[0].bounds.x + results[0].bounds.w / 2;
    expect(cx).toBeCloseTo(0.5);
  });

  it('only the active view gets scale 1.0', () => {
    const results = resolveCarouselLayout(
      { kind: 'carousel', activeIndex: 1 },
      container,
      uniformHints,
    );
    const scales = results.map((r) => r.scale);
    expect(scales.filter((s) => s === 1.0)).toHaveLength(1);
    expect(results[1].scale).toBe(1.0);
  });

  it('applies zStep: active at z=0, inactive recede by distance * zStep', () => {
    const results = resolveCarouselLayout(
      { kind: 'carousel', activeIndex: 1, zStep: 0.5 },
      container,
      uniformHints,
    );
    // Active view (i=1) at z=0
    expect(results[1].z).toBe(0);
    // Flanking views (distance=1) at z=-0.5
    expect(results[0].z).toBeCloseTo(-0.5);
    expect(results[2].z).toBeCloseTo(-0.5);
  });

  it('zStep defaults to 0 when not specified', () => {
    const results = resolveCarouselLayout(
      { kind: 'carousel', activeIndex: 0 },
      container,
      uniformHints,
    );
    expect(results[0].z).toBe(0);
    expect(results[1].z).toBe(0);
    expect(results[2].z).toBe(0);
  });

  it('zStep accumulates with distance for 5-view carousel', () => {
    const hints5 = Array(5).fill({ w: 0.4, h: 0.6 });
    const results = resolveCarouselLayout(
      { kind: 'carousel', activeIndex: 2, zStep: 0.3 },
      container,
      hints5,
    );
    expect(results[2].z).toBe(0);           // active
    expect(results[1].z).toBeCloseTo(-0.3);  // distance=1
    expect(results[3].z).toBeCloseTo(-0.3);  // distance=1
    expect(results[0].z).toBeCloseTo(-0.6);  // distance=2
    expect(results[4].z).toBeCloseTo(-0.6);  // distance=2
  });
});

describe('resolveLoopCarouselLayout', () => {
  const loopHints = [
    { w: 0.4, h: 0.8 },
    { w: 0.4, h: 0.8 },
    { w: 0.4, h: 0.8 },
  ];

  it('active view at front center (z=0, scale=1, centered x)', () => {
    const results = resolveLoopCarouselLayout(
      { kind: 'carousel', activeIndex: 0, loop: true, zStep: 4.0 },
      container,
      loopHints,
    );
    expect(results[0].z).toBe(0);
    expect(results[0].scale).toBe(1.0);
    // Active should be centered: bounds.x + bounds.w/2 ≈ 0.5
    const cx = results[0].bounds.x + results[0].bounds.w / 2;
    expect(cx).toBeCloseTo(0.5);
  });

  it('back views recede to -zStep', () => {
    const results = resolveLoopCarouselLayout(
      { kind: 'carousel', activeIndex: 0, loop: true, zStep: 4.0 },
      container,
      [{ w: 0.3, h: 0.6 }, { w: 0.3, h: 0.6 }],
    );
    // N=2: active at angle=0, other at angle=π (directly behind)
    expect(results[0].z).toBe(0);
    expect(results[1].z).toBeCloseTo(-4.0);
  });

  it('3 views evenly distributed: two flanking at ±120° with equal Z', () => {
    const results = resolveLoopCarouselLayout(
      { kind: 'carousel', activeIndex: 0, loop: true, zStep: 6.0 },
      container,
      loopHints,
    );
    // View 1 at 120°, view 2 at 240° — both at cos = -0.5
    // z = -radiusZ * (1 - cos) = -3 * (1 - (-0.5)) = -3 * 1.5 = -4.5
    expect(results[1].z).toBeCloseTo(-4.5);
    expect(results[2].z).toBeCloseTo(-4.5);
    // Both should be symmetric in X around center
    const cx1 = results[1].bounds.x + results[1].bounds.w / 2;
    const cx2 = results[2].bounds.x + results[2].bounds.w / 2;
    expect(Math.abs((0.5 - cx2) - (cx1 - 0.5))).toBeCloseTo(0, 5);
  });

  it('changing activeIndex rotates the ring — each view gets different Z', () => {
    // activeIndex=0: view 0 is front
    const r0 = resolveLoopCarouselLayout(
      { kind: 'carousel', activeIndex: 0, loop: true, zStep: 6.0 },
      container,
      loopHints,
    );
    // activeIndex=1: view 1 is front
    const r1 = resolveLoopCarouselLayout(
      { kind: 'carousel', activeIndex: 1, loop: true, zStep: 6.0 },
      container,
      loopHints,
    );
    // View 0 was at front (z=0), now should be behind
    expect(r0[0].z).toBe(0);
    expect(r1[0].z).toBeCloseTo(-4.5); // at 240° from new active
    // View 1 was behind, now at front
    expect(r0[1].z).toBeCloseTo(-4.5);
    expect(r1[1].z).toBe(0);
  });

  it('scale varies with depth: front=1.0, back=inactiveScale', () => {
    const results = resolveLoopCarouselLayout(
      { kind: 'carousel', activeIndex: 0, loop: true, zStep: 4.0, inactiveScale: 0.5 },
      container,
      [{ w: 0.4, h: 0.6 }, { w: 0.4, h: 0.6 }],
    );
    expect(results[0].scale).toBe(1.0);        // front
    expect(results[1].scale).toBeCloseTo(0.5);  // back = inactiveScale
  });

  it('layer: front items get highest layer', () => {
    const results = resolveLoopCarouselLayout(
      { kind: 'carousel', activeIndex: 0, loop: true, zStep: 4.0 },
      container,
      loopHints,
    );
    // Active view should have the highest layer
    expect(results[0].layer).toBeGreaterThan(results[1].layer);
    // Both flanking views at same depth should have same layer
    expect(results[1].layer).toBe(results[2].layer);
  });

  it('single view is centered with no depth', () => {
    const results = resolveLoopCarouselLayout(
      { kind: 'carousel', activeIndex: 0, loop: true, zStep: 10 },
      container,
      [{ w: 0.6, h: 0.8 }],
    );
    expect(results).toHaveLength(1);
    expect(results[0].z).toBe(0);
    expect(results[0].scale).toBe(1.0);
  });

  it('dispatched via resolveCarouselLayout when loop=true', () => {
    const results = resolveCarouselLayout(
      { kind: 'carousel', activeIndex: 0, loop: true, zStep: 4.0 },
      container,
      loopHints,
    );
    // Should use loop layout — active at z=0, others behind
    expect(results[0].z).toBe(0);
    expect(results[1].z).toBeLessThan(0);
  });

  // ── Adaptive spread ──────────────────────────────────────────────────────

  it('adaptive spread: small zStep produces wider radius than large zStep', () => {
    const shallow = resolveLoopCarouselLayout(
      { kind: 'carousel', activeIndex: 1, loop: true, zStep: 2 },
      container,
      loopHints,
    );
    const deep = resolveLoopCarouselLayout(
      { kind: 'carousel', activeIndex: 1, loop: true, zStep: 15 },
      container,
      loopHints,
    );
    // View 0 is at angle -120° (same angular position in both), but its
    // x offset from center should be larger with shallow zStep.
    const shallowOffset = Math.abs(
      (shallow[0].bounds.x + shallow[0].bounds.w / 2) - 0.5,
    );
    const deepOffset = Math.abs(
      (deep[0].bounds.x + deep[0].bounds.w / 2) - 0.5,
    );
    expect(shallowOffset).toBeGreaterThan(deepOffset);
  });

  it('explicit spread overrides auto-computation', () => {
    const auto = resolveLoopCarouselLayout(
      { kind: 'carousel', activeIndex: 0, loop: true, zStep: 10 },
      container,
      loopHints,
    );
    const wide = resolveLoopCarouselLayout(
      { kind: 'carousel', activeIndex: 0, loop: true, zStep: 10, spread: 0.45 },
      container,
      loopHints,
    );
    // View 1 at 120°: manual spread=0.45 should be wider than auto for zStep=10
    const autoOffset = Math.abs(
      (auto[1].bounds.x + auto[1].bounds.w / 2) - 0.5,
    );
    const wideOffset = Math.abs(
      (wide[1].bounds.x + wide[1].bounds.w / 2) - 0.5,
    );
    expect(wideOffset).toBeGreaterThan(autoOffset);
  });

  // ── Fade (opacity) ───────────────────────────────────────────────────────

  it('fadeMin=1 (default): all views fully opaque', () => {
    const results = resolveLoopCarouselLayout(
      { kind: 'carousel', activeIndex: 0, loop: true, zStep: 4 },
      container,
      loopHints,
    );
    for (const r of results) {
      expect(r.opacity).toBe(1);
    }
  });

  it('fadeMin=0: back views fully transparent, front fully opaque', () => {
    const results = resolveLoopCarouselLayout(
      { kind: 'carousel', activeIndex: 0, loop: true, zStep: 4, fadeMin: 0 },
      container,
      [{ w: 0.3, h: 0.6 }, { w: 0.3, h: 0.6 }],
    );
    // N=2: active at front, other directly behind
    expect(results[0].opacity).toBe(1);
    expect(results[1].opacity).toBeCloseTo(0);
  });

  it('fadeMin=0.3: back at 0.3, front at 1.0, sides intermediate (quadratic curve)', () => {
    const results = resolveLoopCarouselLayout(
      { kind: 'carousel', activeIndex: 0, loop: true, zStep: 4, fadeMin: 0.3 },
      container,
      loopHints,
    );
    expect(results[0].opacity).toBe(1);
    // Views at 120° have depthFactor=0.25, fadeCurve=0.25²=0.0625
    // opacity = 0.3 + 0.7 * 0.0625 = 0.34375
    expect(results[1].opacity).toBeCloseTo(0.34375, 2);
    expect(results[2].opacity).toBeCloseTo(0.34375, 2);
  });

  it('fade rotates with activeIndex', () => {
    const r0 = resolveLoopCarouselLayout(
      { kind: 'carousel', activeIndex: 0, loop: true, zStep: 4, fadeMin: 0 },
      container,
      loopHints,
    );
    const r1 = resolveLoopCarouselLayout(
      { kind: 'carousel', activeIndex: 1, loop: true, zStep: 4, fadeMin: 0 },
      container,
      loopHints,
    );
    // View 0: fully opaque when active=0, faded when active=1
    expect(r0[0].opacity).toBe(1);
    expect(r1[0].opacity).toBeLessThan(1);
    // View 1: faded when active=0, fully opaque when active=1
    expect(r0[1].opacity).toBeLessThan(1);
    expect(r1[1].opacity).toBe(1);
  });
});
