import { describe, it, expect } from 'vitest';
import { compileHudItems } from '../hudCompiler';
import type { HudItemDefinition } from '../../hud/types';

const item = (id: string, overrides?: Partial<HudItemDefinition>): HudItemDefinition => ({
  id,
  children: null,
  ...overrides,
});

describe('compileHudItems', () => {
  it('returns empty array for undefined input', () => {
    expect(compileHudItems(undefined)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(compileHudItems([])).toEqual([]);
  });

  it('passes through enabled items and assigns instance ids', () => {
    const items = [item('a'), item('b', { enabled: true })];
    const result = compileHudItems(items, { sceneId: 's1', phase: 'exit' });
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(['a', 'b']);
    expect(result.map((r) => r.instanceId)).toEqual(['s1:a:0', 's1:b:1']);
    expect(result.map((r) => r.phase)).toEqual(['exit', 'exit']);
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

  it('adds instanceId while preserving authored fields', () => {
    const items = [item('z', { className: 'hud' })];
    const result = compileHudItems(items, { sceneId: 's9' });
    expect(result[0]?.className).toBe('hud');
    expect(result[0]?.instanceId).toBe('s9:z:0');
  });
});
