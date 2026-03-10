import { it, describe, expect } from 'vitest';
import { mergeTheme, withColorMode } from '../mergeTheme';
import { darkGlassTheme } from '../darkGlass';
import { lightMinimalTheme } from '../lightMinimal';
import { neonCyberTheme } from '../neonCyber';
import { enterpriseTheme } from '../enterprise';

it('mergeTheme preserves unmentioned fields from base', () => {
  const result = mergeTheme(darkGlassTheme, { node: { defaultColor: '#ff0000' } });
  expect(result.node.defaultColor).toBe('#ff0000');
  expect(result.node.defaultMetalness).toBe(darkGlassTheme.node.defaultMetalness);
  expect(result.edge).toEqual(darkGlassTheme.edge);
  expect(result.group).toEqual(darkGlassTheme.group);
});

it('mergeTheme applies node.defaultBoxColor overrides', () => {
  const result = mergeTheme(darkGlassTheme, { node: { defaultBoxColor: '#223344' } });
  expect(result.node.defaultBoxColor).toBe('#223344');
});

it('mergeTheme does not mutate base theme', () => {
  const original = darkGlassTheme.node.defaultColor;
  mergeTheme(darkGlassTheme, { node: { defaultColor: '#000' } });
  expect(darkGlassTheme.node.defaultColor).toBe(original);
});

it('mergeTheme merges nested objects (edge config)', () => {
  const result = mergeTheme(darkGlassTheme, {
    edge: { routing: 'flow' },
  });
  expect(result.edge.routing).toBe('flow');
  expect(result.edge.defaultColor).toBe(darkGlassTheme.edge.defaultColor);
  expect(result.edge.defaultThickness).toBe(darkGlassTheme.edge.defaultThickness);
});

it('mergeTheme replaces arrays wholesale (not element-wise)', () => {
  const result = mergeTheme(darkGlassTheme, { palette: ['#aaa', '#bbb'] });
  expect(result.palette).toEqual(['#aaa', '#bbb']);
});

describe('withColorMode', () => {
  it('dark mode returns new theme with light label color', () => {
    const result = withColorMode(darkGlassTheme, 'dark');
    expect(result.node.defaultLabelColor).toBe('#e8eeff');
    expect(result.node.defaultSublabelColor).toBe('#b8c0e0');
  });

  it('light mode returns new theme with dark label color', () => {
    const result = withColorMode(lightMinimalTheme, 'light');
    expect(result.node.defaultLabelColor).toBe('#1a1a2e');
    expect(result.node.defaultSublabelColor).toBe('#4a4a6e');
  });

  it('does not mutate the base theme', () => {
    const originalLabel = darkGlassTheme.node.defaultLabelColor;
    const originalSublabel = darkGlassTheme.node.defaultSublabelColor;
    withColorMode(darkGlassTheme, 'light');
    expect(darkGlassTheme.node.defaultLabelColor).toBe(originalLabel);
    expect(darkGlassTheme.node.defaultSublabelColor).toBe(originalSublabel);
  });

  it('returns a new object (not the same reference as base)', () => {
    const result = withColorMode(darkGlassTheme, 'dark');
    expect(result).not.toBe(darkGlassTheme);
    expect(result.node).not.toBe(darkGlassTheme.node);
  });

  it('preserves all other node fields from the base theme', () => {
    const result = withColorMode(darkGlassTheme, 'dark');
    expect(result.node.defaultColor).toBe(darkGlassTheme.node.defaultColor);
    expect(result.node.defaultMetalness).toBe(darkGlassTheme.node.defaultMetalness);
    expect(result.node.labelSizeFactor).toBe(darkGlassTheme.node.labelSizeFactor);
  });

  it('preserves edge and environment fields unchanged', () => {
    const result = withColorMode(darkGlassTheme, 'dark');
    expect(result.edge).toEqual(darkGlassTheme.edge);
    expect(result.environment).toEqual(darkGlassTheme.environment);
  });

  it('updates group.defaultLabelColor but preserves other group fields', () => {
    const result = withColorMode(darkGlassTheme, 'dark');
    expect(result.group.defaultLabelColor).toBe('#e8eeff');
    expect(result.group.defaultColor).toBe(darkGlassTheme.group.defaultColor);
    expect(result.group.borderMetalness).toBe(darkGlassTheme.group.borderMetalness);
  });

  it('all 4 built-in presets can be passed to withColorMode without error', () => {
    expect(() => withColorMode(darkGlassTheme, 'dark')).not.toThrow();
    expect(() => withColorMode(lightMinimalTheme, 'light')).not.toThrow();
    expect(() => withColorMode(neonCyberTheme, 'dark')).not.toThrow();
    expect(() => withColorMode(enterpriseTheme, 'dark')).not.toThrow();
  });

  it('withColorMode sets group.defaultLabelColor for dark mode', () => {
    const theme = withColorMode(lightMinimalTheme, 'dark');
    expect(theme.group.defaultLabelColor).toBe('#e8eeff');
  });

  it('withColorMode sets group.defaultLabelColor for light mode', () => {
    const theme = withColorMode(darkGlassTheme, 'light');
    expect(theme.group.defaultLabelColor).toBe('#1a1a2e');
  });
});
