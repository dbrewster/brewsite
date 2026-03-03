// Tests for the unified 'glow' DSL prop (Finding 8): replaces emissive/emissiveIntensity/emissiveColor.

import { it, expect } from 'vitest';
import { compileDiagram } from '../compile';
import { darkGlassTheme } from '../themes/darkGlass';

it('glow=false sets emissive=false and emissiveIntensity=0', () => {
  const state = compileDiagram({
    id: 't',
    nodes: [{ id: 'a', label: 'A', glow: false }],
    edges: [],
    groups: [],
  });
  const n = state.nodes.find((n) => n.id === 'a')!;
  expect(n.emissive).toBe(false);
  expect(n.emissiveIntensity).toBe(0);
});

it('glow=true enables emissive with theme intensity', () => {
  const state = compileDiagram(
    { id: 't', nodes: [{ id: 'a', label: 'A', glow: true }], edges: [], groups: [] },
    darkGlassTheme,
  );
  const n = state.nodes.find((n) => n.id === 'a')!;
  expect(n.emissive).toBe(true);
  expect(n.emissiveIntensity).toBe(darkGlassTheme.node.defaultEmissiveIntensity);
});

it('glow object with intensity and color overrides theme', () => {
  const state = compileDiagram({
    id: 't',
    nodes: [{ id: 'a', label: 'A', glow: { intensity: 0.9, color: '#ff0000' } }],
    edges: [],
    groups: [],
  });
  const n = state.nodes.find((n) => n.id === 'a')!;
  expect(n.emissiveIntensity).toBe(0.9);
  expect(n.emissiveColor).toBe('#ff0000');
  expect(n.emissive).toBe(true);
});
