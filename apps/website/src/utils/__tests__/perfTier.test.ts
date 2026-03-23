// Tests for deterministic perf tier resolution.

import { describe, it, expect } from 'vitest';
import { resolvePerfTier } from '../perfTier';

describe('resolvePerfTier', () => {
  it('returns low for mobile with 4 cores and 4GB memory', () => {
    expect(resolvePerfTier({ hardwareConcurrency: 4, deviceMemory: 4, isMobile: true })).toBe('low');
  });

  it('returns low for mobile with 2 cores', () => {
    expect(resolvePerfTier({ hardwareConcurrency: 2, deviceMemory: 8, isMobile: true })).toBe('low');
  });

  it('returns low for mobile with 2GB memory', () => {
    expect(resolvePerfTier({ hardwareConcurrency: 8, deviceMemory: 2, isMobile: true })).toBe('low');
  });

  it('returns high for desktop with 8+ cores and 8+ GB memory', () => {
    expect(resolvePerfTier({ hardwareConcurrency: 8, deviceMemory: 8, isMobile: false })).toBe('high');
  });

  it('returns high for desktop with 16 cores and 16GB memory', () => {
    expect(resolvePerfTier({ hardwareConcurrency: 16, deviceMemory: 16, isMobile: false })).toBe('high');
  });

  it('returns medium for desktop with 4 cores', () => {
    expect(resolvePerfTier({ hardwareConcurrency: 4, deviceMemory: 8, isMobile: false })).toBe('medium');
  });

  it('returns medium for desktop with 4GB memory', () => {
    expect(resolvePerfTier({ hardwareConcurrency: 8, deviceMemory: 4, isMobile: false })).toBe('medium');
  });

  it('returns medium for mobile with 8 cores and 8GB memory', () => {
    expect(resolvePerfTier({ hardwareConcurrency: 8, deviceMemory: 8, isMobile: true })).toBe('medium');
  });

  it('defaults hardwareConcurrency to 4 when undefined', () => {
    expect(resolvePerfTier({ deviceMemory: 8, isMobile: false })).toBe('medium');
  });

  it('defaults deviceMemory to 4 when undefined', () => {
    expect(resolvePerfTier({ hardwareConcurrency: 8, isMobile: false })).toBe('medium');
  });

  it('returns low for mobile with all defaults', () => {
    expect(resolvePerfTier({ isMobile: true })).toBe('low');
  });

  it('returns medium for desktop with all defaults', () => {
    expect(resolvePerfTier({ isMobile: false })).toBe('medium');
  });
});
