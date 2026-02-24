import { describe, it, expect } from 'vitest';
import { compileHudItems } from '../hudCompiler';
import type { HudItemDefinition } from '../../hud/types';

const item = (id: string, overrides?: Partial<HudItemDefinition>): HudItemDefinition => ({
  id,
  node: null,
  ...overrides,
});

describe('compileHudItems', () => {
  it('returns empty array for undefined input', () => {
    expect(compileHudItems(undefined)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(compileHudItems([])).toEqual([]);
  });

  it('passes through enabled items', () => {
    const items = [item('a'), item('b', { enabled: true })];
    const result = compileHudItems(items);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('excludes items with enabled === false', () => {
    const items = [item('visible'), item('hidden', { enabled: false })];
    const result = compileHudItems(items);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('visible');
  });

  it('excludes all items when all are disabled', () => {
    const items = [item('x', { enabled: false }), item('y', { enabled: false })];
    expect(compileHudItems(items)).toHaveLength(0);
  });

  it('preserves item identity (no deep clone)', () => {
    const items = [item('z')];
    const result = compileHudItems(items);
    expect(result[0]).toBe(items[0]);
  });
});
