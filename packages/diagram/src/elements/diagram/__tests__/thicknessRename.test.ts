// Tests verifying that DiagramNodeState uses 'thickness' (not 'depth') after F9 rename.

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
  expect(node.thickness).toBe(0.8);
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
  expect(node.thickness).toBe(darkGlassTheme.node.defaultThickness);
});
