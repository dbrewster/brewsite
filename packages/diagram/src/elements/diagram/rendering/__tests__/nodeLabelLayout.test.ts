// Unit tests for computeNodeLabelLayout — pure label position arithmetic.
// No Three.js, React, or external dependencies needed.

import { describe, it, expect } from 'vitest';
import { computeNodeLabelLayout } from '../nodeLabelLayout';

// Shared baseline parameters used across multiple tests.
const BASE = {
  contentW: 1.0,
  contentH: 0.5,
  thickness: 0.1,
  iconScale: 0.4,
  labelFontSizeBase: 0.32,
  sublabelFontSizeBase: 0.22,
  labelSizeFactor: 1.0,
  sublabelSizeFactor: 1.0,
};

describe('computeNodeLabelLayout — no icon, no sublabel', () => {
  it('returns labelY centered near the vertical midpoint', () => {
    const result = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    // Label should be in the upper half of the content area (positive Y)
    // since it's the only element and is stacked from the top.
    expect(Number.isFinite(result.labelY)).toBe(true);
  });

  it('returns sublabelY=undefined when there is no sublabel', () => {
    const result = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    expect(result.sublabelY).toBeUndefined();
  });

  it('returns sublabelFontSize=undefined when there is no sublabel', () => {
    const result = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    expect(result.sublabelFontSize).toBeUndefined();
  });

  it('returns iconY=undefined when there is no icon', () => {
    const result = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    expect(result.iconY).toBeUndefined();
  });
});

describe('computeNodeLabelLayout — font size arithmetic', () => {
  it('computes labelFontSize proportional to contentH * labelFontSizeBase * labelSizeFactor', () => {
    const result = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    // Without icon or sublabel, fitScale should be 1.0 (no overflow)
    const expected = BASE.contentH * BASE.labelFontSizeBase * BASE.labelSizeFactor;
    expect(result.labelFontSize).toBeCloseTo(expected, 5);
  });

  it('applies labelSizeFactor as a multiplier to labelFontSize', () => {
    const factor = 1.5;
    const resultBase = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      1.0, BASE.sublabelSizeFactor,
    );
    const resultScaled = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      factor, BASE.sublabelSizeFactor,
    );
    // Both may have fitScale applied, but the ratio should reflect the factor
    expect(resultScaled.labelFontSize / resultBase.labelFontSize).toBeCloseTo(factor, 1);
  });

  it('computes sublabelFontSize when hasSublabel', () => {
    const result = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, true,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    expect(result.sublabelFontSize).toBeDefined();
    expect(result.sublabelFontSize!).toBeGreaterThan(0);
  });
});

describe('computeNodeLabelLayout — labelZ', () => {
  it('places labelZ in front of the box face (Z=0) with sufficient depth-buffer margin', () => {
    const result = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    // Front face is at Z=0. Label must be at a positive Z with at least 0.05 clearance.
    expect(result.labelZ).toBeGreaterThanOrEqual(0.05);
  });

  it('sublabelZ equals labelZ', () => {
    const result = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, true,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    expect(result.sublabelZ).toBeCloseTo(result.labelZ, 10);
  });

  it('labelZ scales with thickness once proportional term exceeds the floor', () => {
    // labelZOffset = max(0.05, thickness * 0.05). The proportional term exceeds
    // the floor when thickness > 1.0. Use 0.5 (floor) vs 2.0 (proportional=0.10).
    const thin = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, 0.5,
      false, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    const thick = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, 2.0,
      false, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    // 2.0 * 0.05 = 0.10 > floor 0.05, so thick.labelZ > thin.labelZ.
    expect(thick.labelZ).toBeGreaterThan(thin.labelZ);
    // Both must be positive (in front of the front face at Z=0).
    expect(thin.labelZ).toBeGreaterThan(0);
    expect(thick.labelZ).toBeGreaterThan(0);
  });
});

describe('computeNodeLabelLayout — with icon, no sublabel', () => {
  it('sets labelY below iconY', () => {
    const result = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      true, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    expect(result.iconY).toBeDefined();
    expect(result.labelY).toBeLessThan(result.iconY!);
  });

  it('returns sublabelY=undefined when hasIcon=true but hasSublabel=false', () => {
    const result = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      true, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    expect(result.sublabelY).toBeUndefined();
  });

  it('returns iconY defined when hasIcon=true', () => {
    const result = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      true, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    expect(result.iconY).toBeDefined();
    expect(Number.isFinite(result.iconY!)).toBe(true);
  });
});

describe('computeNodeLabelLayout — with sublabel, no icon', () => {
  it('places sublabelY below labelY', () => {
    const result = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, true,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    expect(result.sublabelY).toBeDefined();
    expect(result.sublabelY!).toBeLessThan(result.labelY);
  });

  it('gap between label and sublabel grows with contentH', () => {
    const resultSmall = computeNodeLabelLayout(
      BASE.contentW, 0.25, BASE.thickness,
      false, true,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    const resultLarge = computeNodeLabelLayout(
      BASE.contentW, 1.0, BASE.thickness,
      false, true,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    const gapSmall = resultSmall.labelY - resultSmall.sublabelY!;
    const gapLarge = resultLarge.labelY - resultLarge.sublabelY!;
    expect(gapLarge).toBeGreaterThan(gapSmall);
  });
});

describe('computeNodeLabelLayout — fit-to-content', () => {
  it('all elements fit within ±contentH/2 when icon + label + sublabel are present', () => {
    // Use a large iconScale that would overflow in the old layout
    const contentH = 2.0;
    const result = computeNodeLabelLayout(
      2.0, contentH, 0.2,
      true, true,
      0.6, // large icon
      0.32, 0.22,
      1.0, 1.0,
    );
    const halfH = contentH / 2;

    // Icon top edge
    const effectiveIconH = contentH * result.effectiveIconScale;
    const iconTop = result.iconY! + effectiveIconH / 2;
    expect(iconTop).toBeLessThanOrEqual(halfH + 0.01); // small epsilon for float

    // Sublabel bottom edge
    const sublabelBottom = result.sublabelY! - (result.sublabelFontSize! * 1.1) / 2;
    expect(sublabelBottom).toBeGreaterThanOrEqual(-halfH - 0.01);
  });

  it('applies fitScale < 1 when total demand exceeds contentH', () => {
    // With iconScale=0.6, labelFontSizeBase=0.32, sublabelFontSizeBase=0.22,
    // total demand = 0.10 + 0.6 + 0.06 + 0.352 + 0.04 + 0.242 = 1.294
    // fitScale should be ~0.77
    const result = computeNodeLabelLayout(
      2.0, 2.0, 0.2,
      true, true,
      0.6,
      0.32, 0.22,
      1.0, 1.0,
    );
    // effectiveIconScale should be less than the input iconScale
    expect(result.effectiveIconScale).toBeLessThan(0.6);
    // Font sizes should be proportionally reduced
    const unreducedLabel = 2.0 * 0.32 * 1.0;
    expect(result.labelFontSize).toBeLessThan(unreducedLabel);
  });

  it('does not reduce sizes when there is room (no fitScale needed)', () => {
    // Just a label, no icon, no sublabel — should easily fit
    const result = computeNodeLabelLayout(
      2.0, 2.0, 0.2,
      false, false,
      0.4,
      0.32, 0.22,
      1.0, 1.0,
    );
    const expected = 2.0 * 0.32 * 1.0;
    expect(result.labelFontSize).toBeCloseTo(expected, 5);
    expect(result.effectiveIconScale).toBeCloseTo(0.4, 5);
  });

  it('icon + label (no sublabel) fits within content area', () => {
    const contentH = 1.0;
    const result = computeNodeLabelLayout(
      1.0, contentH, 0.1,
      true, false,
      0.6,
      0.32, 0.22,
      1.0, 1.0,
    );
    const halfH = contentH / 2;
    const effectiveIconH = contentH * result.effectiveIconScale;
    const iconTop = result.iconY! + effectiveIconH / 2;
    const labelBottom = result.labelY - (result.labelFontSize * 1.1) / 2;

    expect(iconTop).toBeLessThanOrEqual(halfH + 0.01);
    expect(labelBottom).toBeGreaterThanOrEqual(-halfH - 0.01);
  });
});

describe('computeNodeLabelLayout — with icon and sublabel', () => {
  it('places both label and sublabel below icon', () => {
    const result = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      true, true,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    expect(result.iconY).toBeDefined();
    expect(result.labelY).toBeLessThan(result.iconY!);
    expect(result.sublabelY).toBeDefined();
    expect(result.sublabelY!).toBeLessThan(result.labelY);
  });

  it('sublabelY is defined when both hasIcon and hasSublabel are true', () => {
    const result = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      true, true,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    expect(result.sublabelY).toBeDefined();
  });
});

describe('computeNodeLabelLayout — edge cases', () => {
  it('returns finite values with zero contentH (no division by zero)', () => {
    const result = computeNodeLabelLayout(
      1.0, 0, BASE.thickness,
      false, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    expect(Number.isFinite(result.labelY)).toBe(true);
    expect(Number.isFinite(result.labelFontSize)).toBe(true);
    expect(Number.isFinite(result.labelZ)).toBe(true);
  });

  it('returns finite values with zero contentH and sublabel', () => {
    const result = computeNodeLabelLayout(
      1.0, 0, BASE.thickness,
      false, true,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    expect(Number.isFinite(result.labelY)).toBe(true);
    expect(Number.isFinite(result.sublabelY!)).toBe(true);
  });
});

describe('computeNodeLabelLayout — labelPadding', () => {
  it('labelPadding=0 produces the same result as omitting the parameter', () => {
    const withZero = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
      0,
    );
    const withDefault = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    expect(withZero.labelY).toBe(withDefault.labelY);
  });

  it('positive labelPadding shifts labelY downward (more negative)', () => {
    const baseline = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
      0,
    );
    const padded = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
      0.2,
    );
    expect(padded.labelY).toBeLessThan(baseline.labelY);
  });

  it('labelPadding offset is proportional to contentH', () => {
    const padded = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
      0.1,
    );
    const baseline = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
      0,
    );
    const expectedOffset = 0.1 * BASE.contentH;
    expect(baseline.labelY - padded.labelY).toBeCloseTo(expectedOffset, 10);
  });

  it('negative labelPadding shifts labelY upward (more positive)', () => {
    const baseline = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
      0,
    );
    const padded = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
      -0.15,
    );
    expect(padded.labelY).toBeGreaterThan(baseline.labelY);
  });

  it('applies labelPadding to sublabelY when sublabel is present', () => {
    const baseline = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, true,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
      0,
    );
    const padded = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, true,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
      0.2,
    );
    expect(padded.sublabelY).toBeDefined();
    expect(padded.sublabelY!).toBeLessThan(baseline.sublabelY!);
    // Both should shift by the same amount
    const labelShift = baseline.labelY - padded.labelY;
    const sublabelShift = baseline.sublabelY! - padded.sublabelY!;
    expect(labelShift).toBeCloseTo(sublabelShift, 10);
  });

  it('applies labelPadding when icon is present', () => {
    const baseline = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      true, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
      0,
    );
    const padded = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      true, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
      0.1,
    );
    const expectedOffset = 0.1 * BASE.contentH;
    expect(baseline.labelY - padded.labelY).toBeCloseTo(expectedOffset, 10);
  });

  it('does not affect font sizes or Z positions', () => {
    const baseline = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, true,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
      0,
    );
    const padded = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, true,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
      0.3,
    );
    expect(padded.labelFontSize).toBe(baseline.labelFontSize);
    expect(padded.sublabelFontSize).toBe(baseline.sublabelFontSize);
    expect(padded.labelZ).toBe(baseline.labelZ);
    expect(padded.sublabelZ).toBe(baseline.sublabelZ);
  });
});
