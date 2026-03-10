// Tests for NVS validation utilities: validateNVSScalar, validateNVSRect, validateNVSPosition.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
// vi is used for console spy setup only
import { validateNVSScalar, validateNVSRect, validateNVSPosition } from '../nvsValidation';
import type { NVSRect } from '../types';

describe('validateNVSScalar', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('returns true for 0 (lower bound)', () => {
    expect(validateNVSScalar(0, 'x', 'ctx')).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('returns true for 1 (upper bound)', () => {
    expect(validateNVSScalar(1, 'y', 'ctx')).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('returns true for mid-range value', () => {
    expect(validateNVSScalar(0.5, 'w', 'SomeWidget')).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('returns false and calls console.error for value > 1', () => {
    const result = validateNVSScalar(1.5, 'nvsX', '<Diagram id="foo">');
    expect(result).toBe(false);
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0]![0]).toContain('"nvsX"');
    expect(errorSpy.mock.calls[0]![0]).toContain('1.5');
  });

  it('returns false and calls console.error for value < 0', () => {
    const result = validateNVSScalar(-0.1, 'nvsY', 'ModelWidget(m1)');
    expect(result).toBe(false);
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0]![0]).toContain('"nvsY"');
  });

  it('returns false and calls console.error for NaN', () => {
    expect(validateNVSScalar(NaN, 'h', 'ctx')).toBe(false);
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it('returns false and calls console.error for Infinity', () => {
    expect(validateNVSScalar(Infinity, 'w', 'ctx')).toBe(false);
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  // NOTE: Production-mode skip (NODE_ENV === 'production') cannot be tested here because
  // Vite statically replaces process.env.NODE_ENV at transform time. The guard is verified
  // by code review and the static replacement behavior of Vite's build pipeline.
});

describe('validateNVSRect', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('returns true for a valid full-screen rect', () => {
    const rect: NVSRect = { x: 0, y: 0, w: 1, h: 1 };
    expect(validateNVSRect(rect, 'ctx')).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('returns true for a valid partial rect', () => {
    const rect: NVSRect = { x: 0.1, y: 0.1, w: 0.4, h: 0.4 };
    expect(validateNVSRect(rect, 'ctx')).toBe(true);
  });

  it('returns false when x is out of range', () => {
    const rect: NVSRect = { x: -0.1, y: 0, w: 0.5, h: 0.5 };
    expect(validateNVSRect(rect, 'ctx')).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('returns false when x+w exceeds 1', () => {
    const rect: NVSRect = { x: 0.8, y: 0, w: 0.5, h: 0.5 };
    expect(validateNVSRect(rect, 'ctx')).toBe(false);
    const message = errorSpy.mock.calls.find((c) => String(c[0]).includes('x+w'));
    expect(message).toBeDefined();
  });

  it('returns false when y+h exceeds 1', () => {
    const rect: NVSRect = { x: 0, y: 0.8, w: 0.5, h: 0.5 };
    expect(validateNVSRect(rect, 'ctx')).toBe(false);
    const message = errorSpy.mock.calls.find((c) => String(c[0]).includes('y+h'));
    expect(message).toBeDefined();
  });

  // NOTE: Production-mode skip is guaranteed by Vite's static NODE_ENV replacement at build
  // time — not testable via vi.stubEnv because the check is inlined at transform time.
});

describe('validateNVSPosition', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('returns true for a valid center position', () => {
    expect(validateNVSPosition([0.5, 0.5, 0], 'ctx')).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('returns true for z outside [0..1] — z is world-space and unrestricted', () => {
    expect(validateNVSPosition([0.5, 0.5, 100], 'ctx')).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('returns false when x is out of range', () => {
    expect(validateNVSPosition([1.5, 0.5, 0], 'ctx')).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('returns false when y is out of range', () => {
    expect(validateNVSPosition([0.5, -0.1, 0], 'ctx')).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
  });

  // NOTE: Production-mode skip is guaranteed by Vite's static NODE_ENV replacement at build
  // time — not testable via vi.stubEnv because the check is inlined at transform time.
});
