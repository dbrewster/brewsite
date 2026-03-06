// Behavioral regression tests for diagram layout DSL component registration.
// These tests compile a real Diagram DSL through the full handler pipeline and assert
// that node positions reflect the specified layout — not the default 4-column grid fallback.
// If any layout component is deregistered from handlers.ts, the affected test will fail.

import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import { Scene, resolveSceneFromDsl, WidgetRegistry } from '@brewsite/core';
import { registerDiagramHandlers } from '../handlers';
import {
  Diagram,
  DiagramNode,
  DiagramEdge,
  GridLayout,
  FlowLayout,
  HierarchicalLayout,
  ManualLayout,
} from '../../elements/diagram/dsl';
import type { DiagramCanvasState } from '../../elements/diagram/canvas/types';
import type { DiagramNodeState } from '../../elements/diagram/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Compile a <Scene> tree through the full handler pipeline. */
const compileScene = (tree: React.ReactElement): { frame: ReturnType<typeof resolveSceneFromDsl>['frame']; warnings: Array<{ code: string; message: string }> } => {
  const registry = new WidgetRegistry();
  const warnings: Array<{ code: string; message: string }> = [];
  const result = resolveSceneFromDsl(
    tree,
    { sceneIndex: 0, numScenes: 1, assetsReady: false },
    registry,
    (w) => warnings.push(w),
  );
  return { frame: result.frame, warnings };
};

/** Extract compiled DiagramNodeState[] from a frame for the given diagram ID. */
const getDiagramNodes = (
  frame: ReturnType<typeof resolveSceneFromDsl>['frame'],
  diagramId: string,
): ReadonlyArray<DiagramNodeState> => {
  const canvasState = frame.widgets[diagramId] as DiagramCanvasState | undefined;
  if (!canvasState) throw new Error(`No widget state for diagram "${diagramId}"`);
  const diagram = canvasState.diagrams[0];
  if (!diagram) throw new Error(`No diagram in canvas state for "${diagramId}"`);
  return diagram.nodes;
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Diagram layout DSL component registration — behavioral regression', () => {
  beforeAll(() => {
    registerDiagramHandlers();
  });

  // ─── Test 1: GridLayout columns ────────────────────────────────────────────

  it('GridLayout columns=2: node at index 2 is placed in a second row (lower y)', () => {
    // Bug scenario: if GridLayout is not registered, extractDiagramDSL never sees the
    // <GridLayout columns={2}> element — layout falls back to default grid (columns=auto=4).
    // With columns=4, all 5 nodes fit in row 0 (except e), so a.y === c.y.
    // With columns=2 correctly recognized, nodes c and d form row 1 → c.y < a.y.
    const tree = React.createElement(
      Scene, { id: 's1' },
      React.createElement(
        Diagram, { id: 'diag' },
        React.createElement(GridLayout, { columns: 2 }),
        React.createElement(DiagramNode, { id: 'a', label: 'A' }),
        React.createElement(DiagramNode, { id: 'b', label: 'B' }),
        React.createElement(DiagramNode, { id: 'c', label: 'C' }),
        React.createElement(DiagramNode, { id: 'd', label: 'D' }),
        React.createElement(DiagramNode, { id: 'e', label: 'E' }),
      ),
    );

    const { frame } = compileScene(tree);
    const nodes = getDiagramNodes(frame, 'diag');
    const nodeA = nodes.find((n) => n.id === 'a')!;
    const nodeC = nodes.find((n) => n.id === 'c')!;

    expect(nodeA).toBeDefined();
    expect(nodeC).toBeDefined();

    // columns=2: a,b in row 0 (NVS top); c,d in row 1 → c.y > a.y (NVS Y-down)
    // columns=4 (dropped fallback): a,b,c,d all in row 0 → c.y == a.y
    expect(nodeC.position[1]).toBeGreaterThan(nodeA.position[1]);
  });

  // ─── Test 2: FlowLayout ────────────────────────────────────────────────────

  it('FlowLayout top-down: all nodes share the same x (single vertical column)', () => {
    // Bug scenario: if FlowLayout is not registered, layout falls back to grid.
    // Grid places nodes in a horizontal row (different x values per node).
    // FlowLayout top-down places all nodes at x=0 (cross-axis is always 0).
    const tree = React.createElement(
      Scene, { id: 's1' },
      React.createElement(
        Diagram, { id: 'diag' },
        React.createElement(FlowLayout, { direction: 'top-down' }),
        React.createElement(DiagramNode, { id: 'a', label: 'A' }),
        React.createElement(DiagramNode, { id: 'b', label: 'B' }),
        React.createElement(DiagramNode, { id: 'c', label: 'C' }),
      ),
    );

    const { frame } = compileScene(tree);
    const nodes = getDiagramNodes(frame, 'diag');
    const nodeA = nodes.find((n) => n.id === 'a')!;
    const nodeB = nodes.find((n) => n.id === 'b')!;
    const nodeC = nodes.find((n) => n.id === 'c')!;

    expect(nodeA).toBeDefined();
    expect(nodeB).toBeDefined();
    expect(nodeC).toBeDefined();

    // FlowLayout top-down: cross-axis (x) is always 0 for all nodes
    // Grid fallback: nodes are spread across different x values
    expect(nodeA.position[0]).toBeCloseTo(nodeB.position[0]);
    expect(nodeA.position[0]).toBeCloseTo(nodeC.position[0]);

    // Also verify y increases (NVS Y-down: lower on screen = higher y value)
    expect(nodeB.position[1]).toBeGreaterThan(nodeA.position[1]);
    expect(nodeC.position[1]).toBeGreaterThan(nodeB.position[1]);
  });

  // ─── Test 3: HierarchicalLayout ────────────────────────────────────────────

  it('HierarchicalLayout top-down: child node is placed below parent (lower y)', () => {
    // Bug scenario: if HierarchicalLayout is not registered, layout falls back to grid.
    // Grid places both a and b in the same row (same y, columns=4 with only 2 nodes).
    // HierarchicalLayout top-down places b (child of a via edge a→b) below a.
    const tree = React.createElement(
      Scene, { id: 's1' },
      React.createElement(
        Diagram, { id: 'diag' },
        React.createElement(HierarchicalLayout, { direction: 'top-down' }),
        React.createElement(DiagramNode, { id: 'a', label: 'Root' }),
        React.createElement(DiagramNode, { id: 'b', label: 'Child' }),
        React.createElement(DiagramEdge, { from: 'a', to: 'b' }),
      ),
    );

    const { frame } = compileScene(tree);
    const nodes = getDiagramNodes(frame, 'diag');
    const nodeA = nodes.find((n) => n.id === 'a')!;
    const nodeB = nodes.find((n) => n.id === 'b')!;

    expect(nodeA).toBeDefined();
    expect(nodeB).toBeDefined();

    // HierarchicalLayout top-down: b is child of a → b.y > a.y (NVS Y-down: child lower on screen)
    // Grid fallback: a and b share row 0 → a.y == b.y
    expect(nodeB.position[1]).toBeGreaterThan(nodeA.position[1]);
  });

  // ─── Test 4: ManualLayout ──────────────────────────────────────────────────

  it('ManualLayout: nodes without explicit positions are NOT auto-placed (remain at same x)', () => {
    // Bug scenario: if ManualLayout is not registered, layout falls back to grid.
    // Grid places the two nodes at different x positions (auto-layout).
    // ManualLayout does not auto-place — both nodes without positions default to [0,0,0],
    // so after pivot centering they share the same x coordinate.
    const tree = React.createElement(
      Scene, { id: 's1' },
      React.createElement(
        Diagram, { id: 'diag' },
        React.createElement(ManualLayout, {}),
        React.createElement(DiagramNode, { id: 'a', label: 'A' }),
        React.createElement(DiagramNode, { id: 'b', label: 'B' }),
      ),
    );

    const { frame, warnings } = compileScene(tree);
    const nodes = getDiagramNodes(frame, 'diag');
    const nodeA = nodes.find((n) => n.id === 'a')!;
    const nodeB = nodes.find((n) => n.id === 'b')!;

    expect(nodeA).toBeDefined();
    expect(nodeB).toBeDefined();

    // ManualLayout emits MISSING_LAYOUT_POSITION warnings for non-ghost nodes without positions
    expect(warnings.some((w) => w.code === 'MISSING_LAYOUT_POSITION')).toBe(true);

    // Both nodes default to [0,0,0] in manual mode — same x after pivot centering
    // Grid fallback: auto-places nodes at different x positions (n0.x=-3, n1.x=3)
    expect(nodeA.position[0]).toBeCloseTo(nodeB.position[0]);
  });

  // ─── Test 5: Default fallback sanity ──────────────────────────────────────

  it('Default (no layout component): first four nodes are placed in the same row', () => {
    // Sanity check: with no layout component, the default grid (columns=auto=4) is used.
    // Five nodes: a,b,c,d in row 0 (same y); e in row 1 (lower y).
    const tree = React.createElement(
      Scene, { id: 's1' },
      React.createElement(
        Diagram, { id: 'diag' },
        React.createElement(DiagramNode, { id: 'a', label: 'A' }),
        React.createElement(DiagramNode, { id: 'b', label: 'B' }),
        React.createElement(DiagramNode, { id: 'c', label: 'C' }),
        React.createElement(DiagramNode, { id: 'd', label: 'D' }),
        React.createElement(DiagramNode, { id: 'e', label: 'E' }),
      ),
    );

    const { frame } = compileScene(tree);
    const nodes = getDiagramNodes(frame, 'diag');
    const nodeA = nodes.find((n) => n.id === 'a')!;
    const nodeC = nodes.find((n) => n.id === 'c')!;
    const nodeE = nodes.find((n) => n.id === 'e')!;

    expect(nodeA).toBeDefined();
    expect(nodeC).toBeDefined();
    expect(nodeE).toBeDefined();

    // Default grid (4 columns): a,b,c,d all in row 0 → same y
    expect(nodeA.position[1]).toBeCloseTo(nodeC.position[1]);
    // e overflows into row 1 → higher NVS y (lower on screen)
    expect(nodeE.position[1]).toBeGreaterThan(nodeA.position[1]);
  });
});
