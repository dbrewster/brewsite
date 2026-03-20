// Tests verifying that DiagramNodeState uses 'thickness' (not 'depth') after F9 rename.
// Thickness values are now authored in NVS fractions and scaled by scaleFactor only.
// When layout fits in [0..1], scaleFactor = 1.0 and compiled = authored.

import { it, expect } from 'vitest';
import { compileDiagram } from '../compile';
import { darkGlassTheme } from '../themes/darkGlass';

it('DiagramNodeState has thickness field (not depth)', () => {
  const state = compileDiagram({
    id: 'test',
    nodes: [{ id: 'a', label: 'A', thickness: 0.120 }],
    edges: [],
    groups: [],
  });
  const node = state.nodes.find((n) => n.id === 'a')!;
  // Thickness is now in NVS; scaleFactor = 1.0 for small layout → compiled = authored.
  expect(node.thickness).toBeGreaterThan(0);
  expect(node.thickness).toBeCloseTo(0.120, 3);
  expect('depth' in node).toBe(false);
});

it('DiagramNodeState.thickness defaults from theme.node.defaultThickness', () => {
  const state = compileDiagram({
    id: 'test',
    nodes: [{ id: 'a', label: 'A' }],
    edges: [],
    groups: [],
  }, darkGlassTheme);
  const node = state.nodes.find((n) => n.id === 'a')!;
  // Theme defaultThickness is now in NVS. scaleFactor = 1.0 → compiled = theme value.
  expect(node.thickness).toBeGreaterThan(0);
  expect(node.thickness).toBeCloseTo(darkGlassTheme.node.defaultThickness, 3);
});
