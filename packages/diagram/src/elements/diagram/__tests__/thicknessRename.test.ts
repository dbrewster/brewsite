// Tests verifying that DiagramNodeState uses 'thickness' (not 'depth') after F9 rename.
// Thickness values are normalized from content-unit scale to NVS fractions by
// multiplying by thicknessNormFactor (= scaleFactor * max(defaultNodeSize)).
// The compiled value is smaller than the authored value.

import { it, expect } from 'vitest';
import { compileDiagram } from '../compile';
import { darkGlassTheme } from '../themes/darkGlass';

it('DiagramNodeState has thickness field (not depth)', () => {
  const state = compileDiagram({
    id: 'test',
    nodes: [{ id: 'a', label: 'A', thickness: 0.8 }],
    edges: [],
    groups: [],
  });
  const node = state.nodes.find((n) => n.id === 'a')!;
  // Thickness is normalized by thicknessNormFactor (= scaleFactor * max(defaultSize)).
  // With NVS-scale defaultSize [0.15, 0.08], the factor is ~0.15, so compiled < authored.
  expect(node.thickness).toBeGreaterThan(0);
  expect(node.thickness).toBeLessThan(0.8);
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
  // Thickness is normalized by thicknessNormFactor (= scaleFactor * max(defaultSize)).
  // With NVS-scale defaultSize [0.15, 0.08], compiled < raw theme default.
  expect(node.thickness).toBeGreaterThan(0);
  expect(node.thickness).toBeLessThan(darkGlassTheme.node.defaultThickness);
});
