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
  labelFontSizeBase: 0.28,
  sublabelFontSizeBase: 0.18,
  labelSizeFactor: 1.0,
  sublabelSizeFactor: 1.0,
};

describe('computeNodeLabelLayout — no icon, no sublabel', () => {
  it('returns labelY=0 when there is no icon and no sublabel', () => {
    const result = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    expect(result.labelY).toBe(0);
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
});

describe('computeNodeLabelLayout — font size arithmetic', () => {
  it('computes labelFontSize = contentH * labelFontSizeBase * labelSizeFactor', () => {
    const result = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    const expected = BASE.contentH * BASE.labelFontSizeBase * BASE.labelSizeFactor;
    expect(result.labelFontSize).toBeCloseTo(expected, 10);
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
    expect(resultScaled.labelFontSize).toBeCloseTo(resultBase.labelFontSize * factor, 10);
  });

  it('computes sublabelFontSize = contentH * sublabelFontSizeBase * sublabelSizeFactor when hasSublabel', () => {
    const result = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, true,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    const expected = BASE.contentH * BASE.sublabelFontSizeBase * BASE.sublabelSizeFactor;
    expect(result.sublabelFontSize).toBeCloseTo(expected, 10);
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
  it('sets labelY below the icon bottom edge (labelY < iconBottomY - gap)', () => {
    const result = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      true, false,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    const iconHeight = BASE.contentH * BASE.iconScale;
    const iconCenterY = BASE.contentH * 0.2;
    const iconBottomY = iconCenterY - iconHeight / 2;
    // labelY should be below iconBottomY (i.e. numerically smaller)
    expect(result.labelY).toBeLessThan(iconBottomY);
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
});

describe('computeNodeLabelLayout — with sublabel, no icon', () => {
  it('sets labelY = contentH * 0.1 (positive offset from center)', () => {
    const result = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      false, true,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    expect(result.labelY).toBeCloseTo(BASE.contentH * 0.1, 10);
  });

  it('places sublabelY below labelY (sublabelY < labelY)', () => {
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

describe('computeNodeLabelLayout — with icon and sublabel', () => {
  it('places both label and sublabel below icon', () => {
    const result = computeNodeLabelLayout(
      BASE.contentW, BASE.contentH, BASE.thickness,
      true, true,
      BASE.iconScale,
      BASE.labelFontSizeBase, BASE.sublabelFontSizeBase,
      BASE.labelSizeFactor, BASE.sublabelSizeFactor,
    );
    const iconHeight = BASE.contentH * BASE.iconScale;
    const iconCenterY = BASE.contentH * 0.2;
    const iconBottomY = iconCenterY - iconHeight / 2;

    expect(result.labelY).toBeLessThan(iconBottomY);
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
