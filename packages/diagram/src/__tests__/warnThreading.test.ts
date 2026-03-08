// Integration tests for onWarn threading across the diagram compilation pipeline.

import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import { Scene, resolveSceneFromDsl, WidgetRegistry } from '@brewsite/core';
import type { DiagramWarnFn } from '../elements/diagram/types';
import { compileDiagram } from '../elements/diagram/compile';
import { resolveLayout } from '../elements/diagram/compiler/layoutAlgorithms';
import { compilePipe } from '../elements/diagram/canvas/compile';
import { darkGlassTheme } from '../elements/diagram/themes/darkGlass';
import { registerDiagramHandlers } from '../compiler/handlers';
import { Diagram, DiagramNode, DiagramGroup, DiagramEnter } from '../elements/diagram/widget';

describe('onWarn threading', () => {
  beforeAll(() => {
    registerDiagramHandlers();
  });

  // Test 1: compileDiagram threads onWarn for edges referencing missing nodes
  it('compileDiagram calls onWarn for edges referencing missing nodes', () => {
    const warns: Array<{ code: string; message: string }> = [];
    const onWarn: DiagramWarnFn = (code, message) => warns.push({ code, message });
    compileDiagram(
      {
        id: 'test',
        nodes: [{ id: 'a' }],
        edges: [{ from: 'a', to: 'NONEXISTENT' }],
        groups: [],
      },
      darkGlassTheme,
      onWarn,
    );
    expect(warns).toHaveLength(1);
    expect(warns[0]!.code).toBe('MISSING_EDGE_ENDPOINT');
    expect(warns[0]!.message).toContain('"NONEXISTENT"');
  });

  // Test 2: onWarn absent — no throw for edge routing failures
  it('compileDiagram does not throw when onWarn is absent and edge references missing node', () => {
    expect(() =>
      compileDiagram({
        id: 'test',
        nodes: [{ id: 'a' }],
        edges: [{ from: 'a', to: 'missing' }],
        groups: [],
      }),
    ).not.toThrow();
  });

  // Test 3: ManualLayout missing positions routes through onWarn
  it('resolveLayout emits MISSING_LAYOUT_POSITION when manual layout node has no position', () => {
    const warns: Array<{ code: string; message: string }> = [];
    const onWarn: DiagramWarnFn = (code, message) => warns.push({ code, message });
    resolveLayout(
      [{ id: 'a', label: 'A' }],
      [],
      { kind: 'manual' },
      onWarn,
    );
    expect(warns[0]!.code).toBe('MISSING_LAYOUT_POSITION');
    expect(warns[0]!.message).toContain('"a"');
  });

  // Test 4: compilePipe emits INVALID_PIPE_REF for bad dot-notation
  it('compilePipe emits INVALID_PIPE_REF for malformed from reference', () => {
    const warns: Array<{ code: string; message: string }> = [];
    compilePipe(
      { from: 'no-dot-here', to: 'a.b' },
      [],
      0,
      'curved',
      'sides',
      (code, msg) => warns.push({ code, message: msg }),
    );
    expect(warns[0]!.code).toBe('INVALID_PIPE_REF');
  });

  // Test 5: extractDiagramDSL warns when Enter is inside a DiagramGroup
  it('warns when <Enter> is placed inside a <DiagramGroup>', () => {
    const warnings: Array<{ code: string; message: string }> = [];
    const tree = React.createElement(
      Scene,
      { id: 's1' },
      React.createElement(
        Diagram,
        { id: 'test' },
        React.createElement(
          DiagramGroup,
          { id: 'g1' },
          React.createElement(DiagramEnter, {}),
          React.createElement(DiagramNode, { id: 'a', label: 'A', position: [0, 0, 0] as [number, number, number] }),
        ),
      ),
    );
    resolveSceneFromDsl(
      tree,
      { sceneIndex: 0, numScenes: 1, assetsReady: false },
      new WidgetRegistry(),
      (w) => warnings.push(w),
    );
    const match = warnings.find((w) => w.code === 'MISPLACED_DIAGRAM_TRANSITION');
    expect(match).toBeDefined();
    expect(match!.message).toContain('DiagramGroup');
  });
});
