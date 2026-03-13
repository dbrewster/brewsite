// Tests for parseHexColor — CSS hex color alpha extraction.

import { describe, it, expect } from 'vitest';
import { parseHexColor } from '../index';

describe('parseHexColor', () => {
  it('parses #RRGGBB with alpha = 1', () => {
    const result = parseHexColor('#FF8800');
    expect(result.rgb).toBe('#FF8800');
    expect(result.alpha).toBe(1);
  });

  it('parses #RRGGBBAA and extracts alpha', () => {
    const result = parseHexColor('#FF880080');
    expect(result.rgb).toBe('#FF8800');
    expect(result.alpha).toBeCloseTo(128 / 255, 4);
  });

  it('parses #RRGGBBAA with full opacity (FF)', () => {
    const result = parseHexColor('#1E1412FF');
    expect(result.rgb).toBe('#1E1412');
    expect(result.alpha).toBe(1);
  });

  it('parses #RRGGBBAA with zero opacity (00)', () => {
    const result = parseHexColor('#1E141200');
    expect(result.rgb).toBe('#1E1412');
    expect(result.alpha).toBe(0);
  });

  it('expands #RGB shorthand', () => {
    const result = parseHexColor('#F80');
    expect(result.rgb).toBe('#FF8800');
    expect(result.alpha).toBe(1);
  });

  it('expands #RGBA shorthand and extracts alpha', () => {
    const result = parseHexColor('#F808');
    expect(result.rgb).toBe('#FF8800');
    expect(result.alpha).toBeCloseTo(0x88 / 255, 4);
  });

  it('returns unknown formats as-is with alpha = 1', () => {
    const result = parseHexColor('rgb(255, 0, 0)');
    expect(result.rgb).toBe('rgb(255, 0, 0)');
    expect(result.alpha).toBe(1);
  });

  it('handles lowercase hex', () => {
    const result = parseHexColor('#ff880080');
    expect(result.rgb).toBe('#ff8800');
    expect(result.alpha).toBeCloseTo(128 / 255, 4);
  });
});
