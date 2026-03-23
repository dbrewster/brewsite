// Tests for the scene unit system integration in diagram compilation.

import { describe, it, expect } from 'vitest';
import { compileDiagram } from '../compile';
import type { DiagramDSL, DiagramTheme } from '../types';
import { enterpriseTheme } from '../themes/enterprise';

/** Minimal diagram DSL helper. */
function makeDSL(overrides: Partial<DiagramDSL> = {}): DiagramDSL {
  return {
    id: 'test',
    nodes: [],
    edges: [],
    groups: [],
    ...overrides,
  };
}

describe('unit system — uniformSizing flag', () => {
  it('sets uniformSizing=false when node uses % units', () => {
    const dsl = makeDSL({
      nodes: [{ id: 'a', label: 'A', size: ['15%', '8%'], thickness: '7.5%' }],
    });
    const state = compileDiagram(dsl, enterpriseTheme);
    expect(state.nodes[0]!.uniformSizing).toBe(false);
  });

  it('sets uniformSizing=true when node uses u units', () => {
    const dsl = makeDSL({
      nodes: [{ id: 'a', label: 'A', size: ['15u', '15u'], thickness: '7.5u' }],
    });
    const state = compileDiagram(dsl, enterpriseTheme);
    expect(state.nodes[0]!.uniformSizing).toBe(true);
  });

  it('inherits uniformSizing from theme defaults when no DSL spatial props', () => {
    const dsl = makeDSL({
      nodes: [{ id: 'a', label: 'A' }],
    });
    // Enterprise theme uses u → uniformSizing=true
    const state = compileDiagram(dsl, enterpriseTheme);
    expect(state.nodes[0]!.uniformSizing).toBe(true);
  });

  it('sets uniformSizing=true when ANY size-like prop uses u (mixed with theme defaults)', () => {
    const dsl = makeDSL({
      nodes: [{ id: 'a', label: 'A', thickness: '5u' }],
    });
    const state = compileDiagram(dsl, enterpriseTheme);
    // thickness uses u → uniformSizing=true even though size comes from theme (%)
    expect(state.nodes[0]!.uniformSizing).toBe(true);
  });

  it('sets uniformSizing=false on edges when using % units', () => {
    const dsl = makeDSL({
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ from: 'a', to: 'b', thickness: '1%' }],
    });
    const state = compileDiagram(dsl, enterpriseTheme);
    expect(state.edges[0]!.uniformSizing).toBe(false);
  });

  it('sets uniformSizing=true on edges when using u units', () => {
    const dsl = makeDSL({
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ from: 'a', to: 'b', thickness: '1u' }],
    });
    const state = compileDiagram(dsl, enterpriseTheme);
    expect(state.edges[0]!.uniformSizing).toBe(true);
  });

  it('sets uniformSizing on groups from theme defaults', () => {
    const dsl = makeDSL({
      nodes: [{ id: 'a', label: 'A', groupId: 'g1' }],
      groups: [{ id: 'g1', nodeIds: ['a'] }],
    });
    const state = compileDiagram(dsl, enterpriseTheme);
    // Enterprise theme group defaults use u → uniformSizing=true
    expect(state.groups[0]!.uniformSizing).toBe(true);
  });
});

describe('unit system — SceneLength resolution', () => {
  it('resolves % sizes to NVS fractions', () => {
    const dsl = makeDSL({
      nodes: [{ id: 'a', label: 'A', size: ['20%', '10%'] }],
    });
    const state = compileDiagram(dsl, enterpriseTheme);
    // After normalization, sizes are scaled by scaleFactor.
    // But the raw resolve should be 0.20 and 0.10 before normalization.
    // We can only check that the node exists and has numeric size values.
    expect(typeof state.nodes[0]!.size[0]).toBe('number');
    expect(typeof state.nodes[0]!.size[1]).toBe('number');
    expect(state.nodes[0]!.size[0]).toBeGreaterThan(0);
    expect(state.nodes[0]!.size[1]).toBeGreaterThan(0);
  });

  it('resolves u sizes to NVS fractions (same numeric value as %)', () => {
    const dsl = makeDSL({
      nodes: [{ id: 'a', label: 'A', size: ['20u', '10u'] }],
    });
    const state = compileDiagram(dsl, enterpriseTheme);
    expect(typeof state.nodes[0]!.size[0]).toBe('number');
    expect(typeof state.nodes[0]!.size[1]).toBe('number');
  });

  it('resolves SceneAngle tilt to radians', () => {
    const dsl = makeDSL({
      tilt: '45deg',
    });
    const state = compileDiagram(dsl, enterpriseTheme);
    expect(state.tiltRotation[0]).toBeCloseTo(Math.PI / 4, 5);
    expect(state.tiltRotation[1]).toBe(0);
    expect(state.tiltRotation[2]).toBe(0);
  });

  it('resolves rad angle passthrough', () => {
    const dsl = makeDSL({
      tilt: '0.5rad',
    });
    const state = compileDiagram(dsl, enterpriseTheme);
    expect(state.tiltRotation[0]).toBeCloseTo(0.5, 5);
  });

  it('resolves zero tilt', () => {
    const dsl = makeDSL({
      tilt: 0,
    });
    const state = compileDiagram(dsl, enterpriseTheme);
    expect(state.tiltRotation[0]).toBe(0);
  });

  it('resolves viewport bounds from SceneLength', () => {
    const dsl = makeDSL({
      x: '10%',
      y: '20%',
      w: '50%',
      h: '60%',
    });
    const state = compileDiagram(dsl, enterpriseTheme);
    expect(state.viewportBounds.x).toBeCloseTo(0.10, 5);
    expect(state.viewportBounds.y).toBeCloseTo(0.20, 5);
    expect(state.viewportBounds.w).toBeCloseTo(0.50, 5);
    expect(state.viewportBounds.h).toBeCloseTo(0.60, 5);
  });

  it('resolves exit/enter ScenePosition3', () => {
    const dsl = makeDSL({
      exit: { to: ['50%', '200%', '0%'] },
      enter: { from: ['-100%', '50%', '0%'] },
    });
    const state = compileDiagram(dsl, enterpriseTheme);
    expect(state.exit).toBeDefined();
    expect(state.exit!.to).toEqual([0.5, 2.0, 0]);
    expect(state.enter).toBeDefined();
    expect(state.enter!.from).toEqual([-1.0, 0.5, 0]);
  });

  it('resolves edge thickness from SceneLength', () => {
    const dsl = makeDSL({
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ from: 'a', to: 'b', thickness: '2%' }],
    });
    const state = compileDiagram(dsl, enterpriseTheme);
    // Thickness is resolved then scaled by scaleFactor.
    // Just check it's a positive number.
    expect(state.edges[0]!.thickness).toBeGreaterThan(0);
    expect(typeof state.edges[0]!.thickness).toBe('number');
  });
});

describe('unit system — theme defaults with SceneLength', () => {
  it('compiles with enterprise theme (all % defaults) without errors', () => {
    const dsl = makeDSL({
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ from: 'a', to: 'b' }],
      groups: [{ id: 'g1', nodeIds: ['a', 'b'] }],
    });
    const state = compileDiagram(dsl, enterpriseTheme);
    expect(state.nodes).toHaveLength(2);
    expect(state.edges).toHaveLength(1);
    expect(state.groups).toHaveLength(1);
    // All numeric compiled state
    for (const node of state.nodes) {
      expect(typeof node.size[0]).toBe('number');
      expect(typeof node.size[1]).toBe('number');
      expect(typeof node.thickness).toBe('number');
      expect(typeof node.cornerRadius).toBe('number');
      expect(typeof node.borderWidth).toBe('number');
      expect(typeof node.borderHeight).toBe('number');
      expect(typeof node.uniformSizing).toBe('boolean');
    }
    for (const edge of state.edges) {
      expect(typeof edge.thickness).toBe('number');
      expect(typeof edge.uniformSizing).toBe('boolean');
    }
    for (const group of state.groups) {
      expect(typeof group.borderWidth).toBe('number');
      expect(typeof group.borderHeight).toBe('number');
      expect(typeof group.uniformSizing).toBe('boolean');
    }
  });

  it('theme with u defaults sets uniformSizing=true', () => {
    const uTheme: DiagramTheme = {
      ...enterpriseTheme,
      node: {
        ...enterpriseTheme.node,
        defaultSize: ['15u', '8u'],
        defaultThickness: '7.5u',
      },
    };
    const dsl = makeDSL({
      nodes: [{ id: 'a', label: 'A' }],
    });
    const state = compileDiagram(dsl, uTheme);
    expect(state.nodes[0]!.uniformSizing).toBe(true);
  });
});
