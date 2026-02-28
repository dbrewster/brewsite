import { describe, expect, it } from 'vitest';
import React from 'react';
import { resolveSceneFromDsl, Scene } from '@brewsite/core';
import { WidgetRegistry } from '@brewsite/core';
import { Diagram, DiagramEdge, DiagramGroup, DiagramNode, ManualLayout } from '../../elements/diagram/dsl';
import { ImagePanel } from '../../elements/image-panel/dsl';
import { Screen } from '../../elements/screen/dsl';
import { registerDiagramHandlers } from '../handlers';
import type { DiagramState } from '../../elements/diagram/types';
import type { ImagePanelState } from '../../elements/image-panel/types';
import type { ScreenState } from '../../elements/screen/types';

const makeContext = () => ({
  sceneProgress: 0,
  globalProgress: 0,
  clipMeta: [],
  prefersReducedMotion: false,
});

describe('registerDiagramHandlers', () => {
  it('compiles diagram/image-panel/screen widgets into frame state', () => {
    registerDiagramHandlers();

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

    const { frame } = resolveSceneFromDsl(tree, makeContext(), new WidgetRegistry());

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
    registerDiagramHandlers();

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

    const { frame } = resolveSceneFromDsl(tree, makeContext(), new WidgetRegistry());
    const diagram = frame.widgets['diagram-nested'] as DiagramState;
    const inner = diagram.groups.find((g) => g.id === 'inner');
    const outer = diagram.groups.find((g) => g.id === 'outer');

    expect(inner?.parentId).toBe('outer');
    expect(outer).toBeDefined();
    expect(diagram.nodes.find((n) => n.id === 'n1')?.groupId).toBe('inner');
  });
});
