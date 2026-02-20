import {describe, expect, it} from 'vitest';
import {DEFAULT_ANNOTATION_STYLE} from '../annotationDefaults';
import {computeAnchorOffset, computeLabelSize} from '../annotationLayout';

describe('annotationLayout', () => {
  it('clamps label size to min and max constraints', () => {
    const size = computeLabelSize(100, 1, DEFAULT_ANNOTATION_STYLE);
    expect(size.width).toBeLessThanOrEqual(DEFAULT_ANNOTATION_STYLE.maxWidth);
    expect(size.height).toBeGreaterThanOrEqual(DEFAULT_ANNOTATION_STYLE.minHeight);
  });

  it('computes anchor offsets', () => {
    const offset = computeAnchorOffset(2, 1, 'left', 'top');
    expect(offset[0]).toBeCloseTo(1, 3);
    expect(offset[1]).toBeCloseTo(0.5, 3);
  });

  it('computes bottom anchor offsets', () => {
    const offset = computeAnchorOffset(2, 1, 'left', 'bottom');
    expect(offset[0]).toBeCloseTo(1, 3);
    expect(offset[1]).toBeCloseTo(-0.5, 3);
  });
});
