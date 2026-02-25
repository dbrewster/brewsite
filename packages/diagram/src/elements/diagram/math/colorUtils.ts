// Pure hex color manipulation utility. No Three.js. No DOM.

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
  if (normalized.length !== 6) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
};

const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (value: number): string => value.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toLowerCase();
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

const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hPrime = h / 60;
  const x = c * (1 - Math.abs((hPrime % 2) - 1));

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hPrime >= 0 && hPrime < 1) {
    r1 = c;
    g1 = x;
  } else if (hPrime >= 1 && hPrime < 2) {
    r1 = x;
    g1 = c;
  } else if (hPrime >= 2 && hPrime < 3) {
    g1 = c;
    b1 = x;
  } else if (hPrime >= 3 && hPrime < 4) {
    g1 = x;
    b1 = c;
  } else if (hPrime >= 4 && hPrime < 5) {
    r1 = x;
    b1 = c;
  } else if (hPrime >= 5 && hPrime < 6) {
    r1 = c;
    b1 = x;
  }

  const m = l - c / 2;
  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);

  return [r, g, b];
};

/**
 * Adjusts the lightness of a CSS hex color by a delta amount.
 *
 * @param hex   - CSS hex string: '#rrggbb' (6-digit only, lowercase or uppercase)
 * @param delta - Lightness delta in range [-1, 1].
 *                Positive = lighten (towards white), Negative = darken (towards black).
 *                Applied to the HSL L channel, clamped to [0, 1].
 * @returns     - CSS hex string '#rrggbb' with adjusted lightness
 */
export function deriveColor(hex: string, delta: number): string {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const nextL = clamp01(l + delta);
  const [nr, ng, nb] = hslToRgb(h, s, nextL);
  return rgbToHex(nr, ng, nb);
}
