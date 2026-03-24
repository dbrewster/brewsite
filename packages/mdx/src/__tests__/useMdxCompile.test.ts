// Tests for useMdxCompile utilities — pure function tests for hash and cache.

import { describe, it, expect, beforeEach } from 'vitest';
import { fnv1aHash, clearMdxCache, getMdxCacheSize } from '../useMdxCompile';

// ─── fnv1aHash ───────────────────────────────────────────────────────────────

describe('fnv1aHash', () => {
  it('returns a number for any string input', () => {
    const result = fnv1aHash('hello');
    expect(typeof result).toBe('number');
  });

  it('returns consistent hash for same input', () => {
    const a = fnv1aHash('hello world');
    const b = fnv1aHash('hello world');
    expect(a).toBe(b);
  });

  it('returns different hashes for different inputs', () => {
    const a = fnv1aHash('hello');
    const b = fnv1aHash('world');
    expect(a).not.toBe(b);
  });

  it('returns a non-negative integer', () => {
    const result = fnv1aHash('test');
    expect(result).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('handles empty string', () => {
    const result = fnv1aHash('');
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('handles long strings', () => {
    const longStr = 'a'.repeat(10000);
    const result = fnv1aHash(longStr);
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

// ─── Cache utilities ─────────────────────────────────────────────────────────

describe('cache utilities', () => {
  beforeEach(() => {
    clearMdxCache();
  });

  it('clearMdxCache resets cache size to 0', () => {
    clearMdxCache();
    expect(getMdxCacheSize()).toBe(0);
  });

  it('getMdxCacheSize returns 0 for empty cache', () => {
    expect(getMdxCacheSize()).toBe(0);
  });
});
