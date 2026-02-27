import { describe, it, expect } from 'vitest';
import { deriveColor } from '../math/colorUtils';

const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = hex.replace('#', '');
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
};

const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    switch (max) {
      case rn:
        h = ((gn - bn) / delta) % 6;
        break;
      case gn:
        h = (bn - rn) / delta + 2;
        break;
      default:
        h = (rn - gn) / delta + 4;
        break;
    }
    h *= 60;
    if (h < 0) {
      h += 360;
    }
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return [h, s, l];
};

const hslFromHex = (hex: string): [number, number, number] => {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHsl(r, g, b);
};

describe('deriveColor', () => {
  it('returns a valid hex string', () => {
    const next = deriveColor('#2a2d3e', 0.1);
    expect(next).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('darkening returns a darker color (lower L value)', () => {
    const original = hslFromHex('#2a2d3e');
    const darker = hslFromHex(deriveColor('#2a2d3e', -0.15));
    expect(darker[2]).toBeLessThan(original[2]);
  });

  it('lightening returns a lighter color (higher L value)', () => {
    const original = hslFromHex('#2a2d3e');
    const lighter = hslFromHex(deriveColor('#2a2d3e', 0.25));
    expect(lighter[2]).toBeGreaterThan(original[2]);
  });

  it('clamps at black — darken(#000000) returns #000000', () => {
    expect(deriveColor('#000000', -0.5)).toBe('#000000');
  });

  it('clamps at white — lighten(#ffffff) returns #ffffff', () => {
    expect(deriveColor('#ffffff', 0.5)).toBe('#ffffff');
  });

  it('preserves hue and saturation when adjusting lightness', () => {
    const [h, s] = hslFromHex('#3a6ea5');
    const [nextH, nextS] = hslFromHex(deriveColor('#3a6ea5', 0.2));
    expect(nextH).toBeCloseTo(h, 0);
    expect(nextS).toBeCloseTo(s, 2);
  });

  it('handles uppercase hex input', () => {
    const lower = deriveColor('#AABBCC', -0.1);
    expect(lower).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('throws on invalid hex input length', () => {
    expect(() => deriveColor('#abc', 0.1)).toThrow('Invalid hex color');
  });

  it('covers all HSL hue sectors', () => {
    const samples = ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff'];
    samples.forEach((hex) => {
      expect(deriveColor(hex, 0)).toMatch(/^#[0-9a-f]{6}$/);
    });
  });
});
