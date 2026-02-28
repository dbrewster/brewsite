import { describe, expect, it } from 'vitest';
import React from 'react';
import { resolveSceneFromDsl, Scene } from '@brewsite/core';
import { WidgetRegistry } from '@brewsite/core';
import { Diagram, DiagramEdge, DiagramGroup, DiagramNode, GridLayout, ManualLayout } from '../../elements/diagram/dsl';
import { DiagramCanvas } from '../../elements/diagram/canvas/dsl';
import { ImagePanel } from '../../elements/image-panel/dsl';
import { Screen } from '../../elements/screen/dsl';
import { registerDiagramHandlers } from '../handlers';
import type { DiagramState } from '../../elements/diagram/types';
import type { ImagePanelState } from '../../elements/image-panel/types';
import type { ScreenState } from '../../elements/screen/types';
import { DiagramWidget } from '../../elements/diagram/widget';
import { compileDiagram } from '../../elements/diagram/compile';
import { compileSceneTrack } from '../../../../core/src/compiler/sceneTrackCompiler';
import type { SceneDefinition } from '../../../../core/src/compiler/sceneTypes';

const makeContext = () => ({
  sceneProgress: 0,
  globalProgress: 0,
  clipMeta: [],
  prefersReducedMotion: false,
});

describe('registerDiagramHandlers', () => {
  it('compiles diagram/image-panel/screen widgets into frame state', () => {
    const registry = new WidgetRegistry();
    registry.register(new DiagramWidget('diagram-basic', compileDiagram({
      id: 'diagram-basic',
      nodes: [],
      edges: [],
      groups: [],
    })));
    registerDiagramHandlers(registry);

    const tree = (
      <Scene id="diagram-test">
        <Diagram id="diagram-basic">
          <ManualLayout />
          <DiagramGroup id="group-1" label="Group">
            <DiagramNode id="n1" label="Node 1" position={[0, 0, 0]} />
          </DiagramGroup>
          <DiagramNode id="n2" label="Node 2" position={[4, 0, 0]} />
          <DiagramEdge from="n1" to="n2" />
        </Diagram>

        <ImagePanel id="panel-1" src="/mock.png" />
        <Screen id="screen-1" src="https://example.com" />
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, makeContext(), registry);

    const diagram = frame.widgets['diagram-basic'] as DiagramState;
    const panel = frame.widgets['panel-1'] as ImagePanelState;
    const screen = frame.widgets['screen-1'] as ScreenState;

    expect(diagram.id).toBe('diagram-basic');
    expect(diagram.nodes.length).toBe(2);
    expect(diagram.edges.length).toBe(1);
    expect(diagram.nodes.find((n) => n.id === 'n1')?.groupId).toBe('group-1');
    expect(panel.src).toBe('/mock.png');
    expect(screen.src).toBe('https://example.com');
  });

  it('captures nested groups with parentId and node membership', () => {
    const registry = new WidgetRegistry();
    registry.register(new DiagramWidget('diagram-nested', compileDiagram({
      id: 'diagram-nested',
      nodes: [],
      edges: [],
      groups: [],
    })));
    registerDiagramHandlers(registry);

    const tree = (
      <Scene id="diagram-nested">
        <Diagram id="diagram-nested">
          <ManualLayout />
          <DiagramGroup id="outer" label="Outer">
            <DiagramGroup id="inner" label="Inner">
              <DiagramNode id="n1" label="Node 1" position={[0, 0, 0]} />
            </DiagramGroup>
          </DiagramGroup>
        </Diagram>
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, makeContext(), registry);
    const diagram = frame.widgets['diagram-nested'] as DiagramState;
    const inner = diagram.groups.find((g) => g.id === 'inner');
    const outer = diagram.groups.find((g) => g.id === 'outer');

    expect(inner?.parentId).toBe('outer');
    expect(outer).toBeDefined();
    expect(diagram.nodes.find((n) => n.id === 'n1')?.groupId).toBe('inner');
  });

  it('throws when GridLayout appears at scene top-level', () => {
    const registry = new WidgetRegistry();
    registry.register(new DiagramWidget('diagram', compileDiagram({
      id: 'diagram',
      nodes: [],
      edges: [],
      groups: [],
    })));
    registerDiagramHandlers(registry);

    const tree = (
      <Scene id="top-level-layout">
        <GridLayout />
      </Scene>
    );

    expect(() => resolveSceneFromDsl(tree, makeContext(), registry)).toThrow('GridLayout');
  });

  it('pushes MISSING_WIDGET warning when DiagramCanvas id is not registered', () => {
    const registry = new WidgetRegistry();
    registerDiagramHandlers(registry);

    const scenes: SceneDefinition[] = [
      {
        id: 's1',
        getFrame: () => (
          <Scene id="s1">
            <DiagramCanvas id="missing-canvas">
              <Diagram id="inner">
                <DiagramNode id="n1" label="Node 1" position={[0, 0, 0]} />
              </Diagram>
            </DiagramCanvas>
          </Scene>
        ),
      },
    ];

    const track = compileSceneTrack({
      scenes,
      widgetRegistry: registry,
      blockSize: 10,
    });

    expect(track.warnings?.some((warning) =>
      warning.code === 'MISSING_WIDGET' && warning.widgetId === 'missing-canvas')).toBe(true);
  });
});
