import { describe, expect, it } from 'vitest';
import React from 'react';
import { resolveSceneFromDsl, Scene } from '@brewsite/core';
import type { SceneTheme } from '@brewsite/core';
import { WidgetRegistry } from '@brewsite/core';
import { registerCoreHandlers } from '../../../../core/src/compiler/coreHandlers';
import { View } from '../../../../core/src/compiler/blocks/viewDsl';
import { ViewLayout } from '../../../../core/src/compiler/blocks/viewLayoutDsl';
import { Diagram, DiagramEdge, DiagramGroup, DiagramNode, GridLayout, ManualLayout } from '../../elements/diagram/widget';
import { registerDiagramHandlers } from '../handlers';
import type { DiagramState } from '../../elements/diagram/types';

const makeContext = () => ({
  sceneIndex: 0,
  numScenes: 1,
  assetsReady: false,
  themeFamily: 'default' as const,
  themePolarity: 'dark' as const,
});

describe('registerDiagramHandlers', () => {
  it('compiles diagram widget into frame state', () => {
    const registry = new WidgetRegistry();
    registerCoreHandlers();
    registerDiagramHandlers();

    const tree = (
      <Scene id="diagram-test">
        <Diagram id="diagram-basic">
          <ManualLayout />
          <DiagramGroup id="group-1" label="Group">
            <DiagramNode id="n1" label="Node 1" position={["0%", "0%", "0%"]} />
          </DiagramGroup>
          <DiagramNode id="n2" label="Node 2" position={["400%", "0%", "0%"]} />
          <DiagramEdge from="n1" to="n2" />
        </Diagram>
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, makeContext(), registry);

    const diagram = frame.widgets['diagram-basic'] as DiagramState;

    expect(diagram.id).toBe('diagram-basic');
    expect(diagram.nodes.length).toBe(2);
    expect(diagram.edges.length).toBe(1);
    expect(diagram.nodes.find((n) => n.id === 'n1')?.groupId).toBe('group-1');
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
              <DiagramNode id="n1" label="Node 1" position={["0%", "0%", "0%"]} />
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
          <DiagramNode id="n1" label="Node 1" position={["50%", "50%", "0%"]} boxColor="#334455" />
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
        <View id="v1" x={"20%"} y={"10%"} w={"50%"} h={"60%"}>
          <Diagram id="d1" x={"0%"} y={"0%"} w={"100%"} h={"100%"}>
            <ManualLayout />
            <DiagramNode id="n1" label="A" position={["50%", "50%", "0%"]} />
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
          <DiagramNode id="n1" label="A" position={["50%", "50%", "0%"]} />
        </Diagram>
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, makeContext(), registry);
    const diagram = frame.widgets['d1'] as DiagramState;

    expect(diagram.z).toBeCloseTo(0.5, 5);
  });

  it('carousel children compile with opacity=1 (ViewWidget controls fade at runtime)', () => {
    const registry = new WidgetRegistry();
    registerCoreHandlers();
    registerDiagramHandlers();

    // Carousel fade (fadeMin) is now applied by ViewWidget at runtime, not baked in at
    // compile time. All carousel children compile with opacity=1 regardless of fadeMin.
    const tree = (
      <Scene id="opacity-test">
        <ViewLayout kind="carousel" loop activeIndex={0} fadeMin={0.2}>
          <View id="v-active" w={"40%"} h={"80%"}>
            <Diagram id="d-active">
              <ManualLayout />
              <DiagramNode id="n1" label="A" position={["50%", "50%", "0%"]} />
            </Diagram>
          </View>
          <View id="v-inactive" w={"40%"} h={"80%"}>
            <Diagram id="d-inactive">
              <ManualLayout />
              <DiagramNode id="n2" label="B" position={["50%", "50%", "0%"]} />
            </Diagram>
          </View>
        </ViewLayout>
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, makeContext(), registry);
    const active = frame.widgets['d-active'] as DiagramState;
    const inactive = frame.widgets['d-inactive'] as DiagramState;

    // Both views compile with opacity=1; runtime ViewWidget applies the fadeMin fade.
    expect(active.nodes[0]!.opacity).toBeCloseTo(1, 2);
    expect(inactive.nodes[0]!.opacity).toBeCloseTo(1, 2);
  });

  it('carousel group children compile with full opacity (ViewWidget controls fade at runtime)', () => {
    const registry = new WidgetRegistry();
    registerCoreHandlers();
    registerDiagramHandlers();

    // Carousel fade is applied by ViewWidget at runtime. Groups in both active and
    // inactive carousel views compile with their default fill/border opacities.
    const tree = (
      <Scene id="group-opacity-test">
        <ViewLayout kind="carousel" loop activeIndex={0} fadeMin={0.2}>
          <View id="v-active" w={"40%"} h={"80%"}>
            <Diagram id="d-active">
              <ManualLayout />
              <DiagramGroup id="g1" label="G">
                <DiagramNode id="n1" label="A" position={["50%", "50%", "0%"]} />
              </DiagramGroup>
            </Diagram>
          </View>
          <View id="v-inactive" w={"40%"} h={"80%"}>
            <Diagram id="d-inactive">
              <ManualLayout />
              <DiagramGroup id="g2" label="G">
                <DiagramNode id="n2" label="B" position={["50%", "50%", "0%"]} />
              </DiagramGroup>
            </Diagram>
          </View>
        </ViewLayout>
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, makeContext(), registry);
    const activeGroup = (frame.widgets['d-active'] as DiagramState).groups[0]!;
    const inactiveGroup = (frame.widgets['d-inactive'] as DiagramState).groups[0]!;

    // Both views compile with full opacity; runtime ViewWidget applies the fadeMin fade.
    expect(inactiveGroup.fillOpacity).toBeCloseTo(activeGroup.fillOpacity, 5);
    expect(inactiveGroup.borderOpacity).toBeCloseTo(activeGroup.borderOpacity, 5);
  });
});

// ─── SceneTheme Bridging ──────────────────────────────────────────────────────

const testSceneTheme: SceneTheme = {
  colorMode: 'dark',
  font: { htmlFamily: 'Inter, sans-serif', webglFontUrl: 'https://example.com/inter.ttf' },
  fontSize: { heading: 2.4, body: 1.0, label: 1.0, caption: 1.0, annotation: 0.7 },
};

const makeContextWithTheme = (sceneTheme: SceneTheme) => ({
  ...makeContext(),
  sceneTheme,
});

describe('registerDiagramHandlers — SceneTheme bridging', () => {
  it('bridges sceneTheme.font.webglFontUrl into themeConfig.fontUrl', () => {
    const registry = new WidgetRegistry();
    registerCoreHandlers();
    registerDiagramHandlers();

    const tree = (
      <Scene id="test">
        <Diagram id="d1">
          <ManualLayout />
          <DiagramNode id="n1" label="Node" position={["0%", "0%", "0%"]} />
        </Diagram>
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, makeContextWithTheme(testSceneTheme), registry);
    const state = frame.widgets['d1'] as DiagramState;
    expect(state.themeConfig.fontUrl).toBe('https://example.com/inter.ttf');
  });

  it('bridges sceneTheme.fontSize.label into effectiveLabelSizeFactor', () => {
    const registry = new WidgetRegistry();
    registerCoreHandlers();
    registerDiagramHandlers();

    const scaledTheme: SceneTheme = {
      ...testSceneTheme,
      fontSize: { ...testSceneTheme.fontSize, label: 1.5 },
    };

    const tree = (
      <Scene id="test">
        <Diagram id="d1">
          <ManualLayout />
          <DiagramNode id="n1" label="Node" position={["0%", "0%", "0%"]} />
        </Diagram>
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, makeContextWithTheme(scaledTheme), registry);
    const state = frame.widgets['d1'] as DiagramState;
    // effectiveLabelSizeFactor = theme.node.labelSizeFactor (1.0) * sceneTheme.fontSize.label (1.5)
    expect(state.themeConfig.effectiveLabelSizeFactor).toBeCloseTo(1.5);
  });

  it('falls back to undefined fontUrl when no sceneTheme is provided', () => {
    const registry = new WidgetRegistry();
    registerCoreHandlers();
    registerDiagramHandlers();

    const tree = (
      <Scene id="test">
        <Diagram id="d1">
          <ManualLayout />
          <DiagramNode id="n1" label="Node" position={["0%", "0%", "0%"]} />
        </Diagram>
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, makeContext(), registry);
    const state = frame.widgets['d1'] as DiagramState;
    expect(state.themeConfig.fontUrl).toBeUndefined();
  });
});
