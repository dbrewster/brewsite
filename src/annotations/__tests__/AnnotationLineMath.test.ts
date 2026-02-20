import { describe, it, expect } from 'vitest';
import { computeLineIntersection2D } from '../annotationLineMath';

describe('annotationLineMath', () => {
  it('returns invisible when target is inside bounds', () => {
    const result = computeLineIntersection2D(5, 5, 10, 10);
    expect(result.visible).toBe(false);
  });

  it('returns intersection when target is outside bounds', () => {
    const result = computeLineIntersection2D(20, 0, 10, 10);
    expect(result.visible).toBe(true);
    expect(result.x).toBe(10);
    expect(result.y).toBe(0);
  });
});
