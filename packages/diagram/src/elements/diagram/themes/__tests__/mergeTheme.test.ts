import { it, expect } from 'vitest';
import { mergeTheme } from '../mergeTheme';
import { darkGlassTheme } from '../darkGlass';

it('mergeTheme preserves unmentioned fields from base', () => {
  const result = mergeTheme(darkGlassTheme, { node: { defaultColor: '#ff0000' } });
  expect(result.node.defaultColor).toBe('#ff0000');
  expect(result.node.defaultMetalness).toBe(darkGlassTheme.node.defaultMetalness);
  expect(result.edge).toEqual(darkGlassTheme.edge);
  expect(result.group).toEqual(darkGlassTheme.group);
});

it('mergeTheme does not mutate base theme', () => {
  const original = darkGlassTheme.node.defaultColor;
  mergeTheme(darkGlassTheme, { node: { defaultColor: '#000' } });
  expect(darkGlassTheme.node.defaultColor).toBe(original);
});

it('mergeTheme merges nested objects (edge config)', () => {
  const result = mergeTheme(darkGlassTheme, {
    edge: { routing: 'orthogonal' },
  });
  expect(result.edge.routing).toBe('orthogonal');
  expect(result.edge.defaultColor).toBe(darkGlassTheme.edge.defaultColor);
  expect(result.edge.defaultThickness).toBe(darkGlassTheme.edge.defaultThickness);
});

it('mergeTheme replaces arrays wholesale (not element-wise)', () => {
  const result = mergeTheme(darkGlassTheme, { palette: ['#aaa', '#bbb'] });
  expect(result.palette).toEqual(['#aaa', '#bbb']);
});
