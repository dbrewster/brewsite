// Tests verifying that DiagramNodeState uses 'thickness' (not 'depth') after F9 rename.
// Thickness values are normalized from diagram-content-units to NVS fractions by
// dividing by safeSpanX. The raw theme value is NOT the compiled value — the compiled
// value is proportional to the original, scaled by the diagram's content span.

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
  // Thickness is normalized by safeSpanX — verify it's positive and proportional.
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
  // Normalized thickness should be less than the raw theme default (divided by safeSpanX > 1).
  expect(node.thickness).toBeGreaterThan(0);
  expect(node.thickness).toBeLessThan(darkGlassTheme.node.defaultThickness);
});
