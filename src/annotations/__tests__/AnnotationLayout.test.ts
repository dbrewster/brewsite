import { describe, it, expect } from 'vitest';
import { computeAnchorOffset, computeLabelSize } from '../annotationLayout';
import type { AnnotationStyle } from '../annotationTypes';

describe('annotationLayout', () => {
  it('computeLabelSize respects min/max constraints', () => {
    const style = {} as AnnotationStyle;
    const size = computeLabelSize(1000, 10, style);
    expect(size.width).toBe(400);
    expect(size.height).toBeGreaterThanOrEqual(32);
  });

  it('computeAnchorOffset returns correct offsets', () => {
    expect(computeAnchorOffset(100, 50, 'left', 'top')).toEqual([50, 25, 0]);
    expect(computeAnchorOffset(100, 50, 'right', 'bottom')).toEqual([-50, -25, 0]);
    expect(computeAnchorOffset(100, 50, 'center', 'middle')).toEqual([0, 0, 0]);
  });
});
