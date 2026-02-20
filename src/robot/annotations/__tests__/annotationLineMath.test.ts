import {describe, expect, it} from 'vitest';
import {computeLineIntersection2D} from '../annotationLineMath';

describe('annotationLineMath', () => {
  it('returns invisible when target is inside the label bounds', () => {
    const result = computeLineIntersection2D(0.2, 0.1, 1, 1);
    expect(result.visible).toBe(false);
  });

  it('returns boundary intersection when target is outside', () => {
    const result = computeLineIntersection2D(2, 0, 1, 1);
    expect(result.visible).toBe(true);
    expect(result.x).toBeCloseTo(1, 3);
    expect(result.y).toBeCloseTo(0, 3);
  });
});
