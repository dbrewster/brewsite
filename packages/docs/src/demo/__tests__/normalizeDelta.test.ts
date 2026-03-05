import { describe, it, expect } from 'vitest';
import { normalizeDelta } from '../normalizeDelta';

const makeWheelEvent = (deltaY: number, deltaMode: number): WheelEvent =>
  ({ deltaY, deltaMode } as WheelEvent);

describe('normalizeDelta', () => {
  it('returns deltaY unchanged for DOM_DELTA_PIXEL (mode=0)', () => {
    expect(normalizeDelta(makeWheelEvent(120, 0))).toBe(120);
    expect(normalizeDelta(makeWheelEvent(-80, 0))).toBe(-80);
    expect(normalizeDelta(makeWheelEvent(0, 0))).toBe(0);
  });

  it('multiplies by 16 for DOM_DELTA_LINE (mode=1)', () => {
    expect(normalizeDelta(makeWheelEvent(3, 1))).toBe(48);
    expect(normalizeDelta(makeWheelEvent(-1, 1))).toBe(-16);
  });

  it('multiplies by 800 for DOM_DELTA_PAGE (mode=2)', () => {
    expect(normalizeDelta(makeWheelEvent(1, 2))).toBe(800);
    expect(normalizeDelta(makeWheelEvent(-2, 2))).toBe(-1600);
  });

  it('falls back to deltaY for unknown deltaMode', () => {
    expect(normalizeDelta(makeWheelEvent(50, 99))).toBe(50);
  });
});
