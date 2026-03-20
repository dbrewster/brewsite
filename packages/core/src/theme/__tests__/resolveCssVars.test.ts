// Tests for the resolveCssVars utility.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveCssVars } from '../resolveCssVars';

/** Map of CSS variable names (with --) to values. */
let cssVarMap: Record<string, string>;

beforeEach(() => {
  cssVarMap = {};

  // Stub document.documentElement
  vi.stubGlobal('document', {
    documentElement: {},
  });

  // Stub getComputedStyle to return values from cssVarMap
  vi.stubGlobal('getComputedStyle', () => ({
    getPropertyValue: (name: string): string => cssVarMap[name] ?? '',
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveCssVars', () => {
  it('resolves a simple var(--color) string to the computed value', () => {
    cssVarMap['--brand-primary'] = '#ff0000';
    const result = resolveCssVars({ color: 'var(--brand-primary)' });
    expect(result.color).toBe('#ff0000');
  });

  it('resolves nested objects', () => {
    cssVarMap['--x'] = '#00ff00';
    const result = resolveCssVars({
      node: { defaultColor: 'var(--x)' },
    });
    expect(result.node.defaultColor).toBe('#00ff00');
  });

  it('passes through non-var strings unchanged', () => {
    const result = resolveCssVars({ color: '#123456' });
    expect(result.color).toBe('#123456');
  });

  it('passes through numbers unchanged', () => {
    const result = resolveCssVars({ opacity: 0.5 });
    expect(result.opacity).toBe(0.5);
  });

  it('passes through booleans unchanged', () => {
    const result = resolveCssVars({ visible: true });
    expect(result.visible).toBe(true);
  });

  it('passes through null unchanged', () => {
    const result = resolveCssVars({ value: null });
    expect(result.value).toBeNull();
  });

  it('passes through undefined unchanged', () => {
    const result = resolveCssVars({ value: undefined });
    expect(result.value).toBeUndefined();
  });

  it('handles arrays with number elements unchanged', () => {
    const result = resolveCssVars({ position: [1, 2, 3] });
    expect(result.position).toEqual([1, 2, 3]);
  });

  it('resolves string elements inside arrays', () => {
    cssVarMap['--a'] = 'red';
    cssVarMap['--b'] = 'blue';
    const result = resolveCssVars({ colors: ['var(--a)', 'var(--b)'] });
    expect(result.colors).toEqual(['red', 'blue']);
  });

  it('supports var(--name, #fallback) syntax when variable is empty', () => {
    // --missing is not in cssVarMap, so getPropertyValue returns ''
    const result = resolveCssVars({ color: 'var(--missing, #abcdef)' });
    expect(result.color).toBe('#abcdef');
  });

  it('prefers the resolved value over fallback when variable is defined', () => {
    cssVarMap['--defined'] = '#111111';
    const result = resolveCssVars({ color: 'var(--defined, #fallback)' });
    expect(result.color).toBe('#111111');
  });

  it('throws when variable is undefined and no fallback provided', () => {
    expect(() => resolveCssVars({ color: 'var(--undefined-var)' })).toThrow(
      'CSS variable "--undefined-var" is not defined',
    );
  });

  it('returns a new object and does not mutate input', () => {
    cssVarMap['--c'] = 'green';
    const input = { color: 'var(--c)' };
    const result = resolveCssVars(input);
    expect(result).not.toBe(input);
    expect(input.color).toBe('var(--c)');
    expect(result.color).toBe('green');
  });

  it('handles deeply nested structures (3+ levels)', () => {
    cssVarMap['--deep'] = 'deep-value';
    const result = resolveCssVars({
      level1: {
        level2: {
          level3: {
            value: 'var(--deep)',
          },
        },
      },
    });
    expect(result.level1.level2.level3.value).toBe('deep-value');
  });
});
