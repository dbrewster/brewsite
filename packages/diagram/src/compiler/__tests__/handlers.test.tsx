import { describe, expect, it } from 'vitest';
import React from 'react';
import { resolveSceneFromDsl, Scene } from '@brewsite/core';
import { WidgetRegistry } from '@brewsite/core';
import { registerCoreHandlers } from '../../../../core/src/compiler/coreHandlers';
import { View } from '../../../../core/src/compiler/blocks/viewDsl';
import { ViewLayout } from '../../../../core/src/compiler/blocks/viewLayoutDsl';
import { Diagram, DiagramEdge, DiagramGroup, DiagramNode, GridLayout, ManualLayout } from '../../elements/diagram/widget';
import { ImagePanel } from '../../elements/image-panel/widget';
import { Screen } from '../../elements/screen/widget';
import { registerDiagramHandlers } from '../handlers';
import type { DiagramState } from '../../elements/diagram/types';
import type { ImagePanelState } from '../../elements/image-panel/types';
import type { ScreenState } from '../../elements/screen/types';

const makeContext = () => ({
  sceneIndex: 0,
  numScenes: 1,
  assetsReady: false,
});

describe('registerDiagramHandlers', () => {
  it('compiles diagram/image-panel/screen widgets into frame state', () => {
    const registry = new WidgetRegistry();
    registerDiagramHandlers();

    const tree = (
      <Scene id="diagram-test">
        <ViewLayout kind="stack">
          <View id="v-diagram" w={1} h={1}>
            <Diagram id="diagram-basic">
              <ManualLayout />
              <DiagramGroup id="group-1" label="Group">
                <DiagramNode id="n1" label="Node 1" position={[0, 0, 0]} />
              </DiagramGroup>
              <DiagramNode id="n2" label="Node 2" position={[4, 0, 0]} />
              <DiagramEdge from="n1" to="n2" />
            </Diagram>
          </View>
          <View id="v-panel" w={1} h={1}>
            <ImagePanel id="panel-1" src="/mock.png" />
          </View>
          <View id="v-screen" w={1} h={1}>
            <Screen id="screen-1" src="https://example.com" />
          </View>
        </ViewLayout>
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

    const { frame } = resolveSceneFromDsl(tree, makeContext(), registry);
    const diagram = frame.widgets['diagram-nested'] as DiagramState;
    const inner = diagram.groups.find((g) => g.id === 'inner');
    const outer = diagram.groups.find((g) => g.id === 'outer');

    expect(inner?.parentId).toBe('outer');
    expect(outer).toBeDefined();
    expect(diagram.nodes.find((n) => n.id === 'n1')?.groupId).toBe('inner');
  });

  it('passes DiagramNode boxColor through JSX extraction into compiled node sideColor', () => {
    const registry = new WidgetRegistry();
    registerDiagramHandlers();

    const tree = (
      <Scene id="diagram-box-color">
        <Diagram id="diagram-box-color">
          <ManualLayout />
          <DiagramNode id="n1" label="Node 1" position={[0.5, 0.5, 0]} boxColor="#334455" />
        </Diagram>
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, makeContext(), registry);
    const diagram = frame.widgets['diagram-box-color'] as DiagramState;

    expect(diagram.nodes[0]?.sideColor).toBe('#334455');
  });

  it('ignores GridLayout that appears at scene top-level (no-op handler)', () => {
    const registry = new WidgetRegistry();
    registerDiagramHandlers();

    const tree = (
      <Scene id="top-level-layout">
        <GridLayout />
      </Scene>
    );

    // GridLayout outside a <Diagram> is silently ignored — the handler is a no-op.
    expect(() => resolveSceneFromDsl(tree, makeContext(), registry)).not.toThrow();
  });
});

// ─── Bounds / Z / Opacity Composition ────────────────────────────────────────

describe('Diagram handler composition through View', () => {
  it('composes viewportBounds through a View parent (not raw props)', () => {
    const registry = new WidgetRegistry();
    registerCoreHandlers();
    registerDiagramHandlers();

    // Diagram with x=0, y=0, w=1, h=1 inside a View at x=0.2, w=0.5.
    // Without composition: viewportBounds = {x:0, y:0, w:1, h:1}.
    // With composition: viewportBounds should reflect the View's bounds.
    const tree = (
      <Scene id="compose-test">
        <View id="v1" x={0.2} y={0.1} w={0.5} h={0.6}>
          <Diagram id="d1" x={0} y={0} w={1} h={1}>
            <ManualLayout />
            <DiagramNode id="n1" label="A" position={[0.5, 0.5, 0]} />
          </Diagram>
        </View>
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, makeContext(), registry);
    const diagram = frame.widgets['d1'] as DiagramState;

    // viewportBounds.x should be >= 0.2 (the View's x), not 0.
    expect(diagram.viewportBounds.x).toBeGreaterThanOrEqual(0.2);
    // viewportBounds.w should be <= 0.5 (the View's w), not 1.
    expect(diagram.viewportBounds.w).toBeLessThanOrEqual(0.5);
  });

  it('composes Z offset through a View parent', () => {
    const registry = new WidgetRegistry();
    registerCoreHandlers();
    registerDiagramHandlers();

    // Diagram with z=0.5 inside a scene with a z-offset View.
    // composedZ = parentZ + localZ. At top level parentZ=0, so z=0.5.
    const tree = (
      <Scene id="z-test">
        <Diagram id="d1" z={0.5}>
          <ManualLayout />
          <DiagramNode id="n1" label="A" position={[0.5, 0.5, 0]} />
        </Diagram>
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, makeContext(), registry);
    const diagram = frame.widgets['d1'] as DiagramState;

    expect(diagram.z).toBeCloseTo(0.5, 5);
  });

  it('composes opacity into node and edge opacities when viewOpacity < 1', () => {
    const registry = new WidgetRegistry();
    registerCoreHandlers();
    registerDiagramHandlers();

    // Loop carousel with fadeMin < 1 applies opacity fade to non-active views.
    // (Non-loop carousel always returns opacity=1.)
    const tree = (
      <Scene id="opacity-test">
        <ViewLayout kind="carousel" loop activeIndex={0} fadeMin={0.2}>
          <View id="v-active" w={0.4} h={0.8}>
            <Diagram id="d-active">
              <ManualLayout />
              <DiagramNode id="n1" label="A" position={[0.5, 0.5, 0]} />
            </Diagram>
          </View>
          <View id="v-inactive" w={0.4} h={0.8}>
            <Diagram id="d-inactive">
              <ManualLayout />
              <DiagramNode id="n2" label="B" position={[0.5, 0.5, 0]} />
            </Diagram>
          </View>
        </ViewLayout>
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, makeContext(), registry);
    const active = frame.widgets['d-active'] as DiagramState;
    const inactive = frame.widgets['d-inactive'] as DiagramState;

    // Active view (index 0) has opacity 1 → node opacity unchanged.
    expect(active.nodes[0]!.opacity).toBeCloseTo(1, 2);

    // Inactive view has opacity < 1 (from loop carousel fade) → node opacity reduced.
    expect(inactive.nodes[0]!.opacity).toBeLessThan(1);
    expect(inactive.nodes[0]!.opacity).toBeGreaterThan(0);
  });

  it('composes opacity into group fillOpacity and borderOpacity', () => {
    const registry = new WidgetRegistry();
    registerCoreHandlers();
    registerDiagramHandlers();

    // Loop carousel with fadeMin < 1 applies opacity fade to non-active views.
    const tree = (
      <Scene id="group-opacity-test">
        <ViewLayout kind="carousel" loop activeIndex={0} fadeMin={0.2}>
          <View id="v-active" w={0.4} h={0.8}>
            <Diagram id="d-active">
              <ManualLayout />
              <DiagramGroup id="g1" label="G">
                <DiagramNode id="n1" label="A" position={[0.5, 0.5, 0]} />
              </DiagramGroup>
            </Diagram>
          </View>
          <View id="v-inactive" w={0.4} h={0.8}>
            <Diagram id="d-inactive">
              <ManualLayout />
              <DiagramGroup id="g2" label="G">
                <DiagramNode id="n2" label="B" position={[0.5, 0.5, 0]} />
              </DiagramGroup>
            </Diagram>
          </View>
        </ViewLayout>
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, makeContext(), registry);
    const activeGroup = (frame.widgets['d-active'] as DiagramState).groups[0]!;
    const inactiveGroup = (frame.widgets['d-inactive'] as DiagramState).groups[0]!;

    // Inactive group should have reduced fillOpacity and borderOpacity.
    expect(inactiveGroup.fillOpacity).toBeLessThan(activeGroup.fillOpacity);
    expect(inactiveGroup.borderOpacity).toBeLessThan(activeGroup.borderOpacity);
  });
});
