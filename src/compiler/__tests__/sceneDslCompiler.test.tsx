import { describe, it, expect } from 'vitest';
import React, { Fragment } from 'react';
import { registerNode } from '../registry';
import { resolveSceneFromDsl, Scene } from '../sceneDslCompiler';
import type { CompileApi, CompileHelpers } from '../sceneDslTypes';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import type { SceneSnapshotContext } from '../sceneTypes';

const makeContext = (): SceneSnapshotContext => ({
  sceneIndex: 0,
  numScenes: 1,
  assetsReady: false,
});

describe('sceneDslCompiler', () => {
  it('resolves children and expands fragments and functional components', () => {
    registerNode(Scene, (node, api, helpers) => {
      helpers.compileChildren(node, api);
      const props = node.props as { id?: string; meta?: Record<string, unknown> };
      if (props.id) api.setSceneMeta({ id: props.id });
      if (props.meta) api.setSceneMeta({ meta: props.meta as Record<string, never> });
    });

    const Child = (_props: {
      value: number | ((context: unknown) => number);
      nested?: {
        a?: number | ((context: unknown) => number);
        b?: number | ((context: unknown) => number);
      };
    }) => null;
    const Wrapper = (props: { children?: React.ReactNode }) => <>{props.children}</>;

    registerNode(Child, (node, api, helpers) => {
      const props = helpers.resolveObjectValues(node.props as Record<string, unknown>, api.context);
      const cleaned = helpers.stripUndefinedDeep(props as Record<string, unknown>);
      api.setWidgetState('child', cleaned);
    });

    registerNode(Wrapper, (node, api, helpers) => {
      helpers.compileChildren(node, api);
    });

    const tree = (
      <Scene id="demo">
        <Fragment>
          <Wrapper>
            <Child
              value={() => 5}
              nested={{
                a: () => 3,
                b: undefined,
              }}
            />
          </Wrapper>
        </Fragment>
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, makeContext(), new WidgetRegistry());
    expect(frame.id).toBe('demo');
    expect(frame.widgets['child']).toEqual({ value: 5, nested: { a: 3 } });
  });

  it('resolves arrays and strips undefined deep values', () => {
    registerNode(Scene, (node, api, helpers) => {
      helpers.compileChildren(node, api);
    });

    const ArrayNode = (_props: { values: Array<number | (() => number)>; nested?: { a?: number; b?: number } }) => null;
    registerNode(ArrayNode, (node, api, helpers) => {
      const props = helpers.resolveObjectValues(node.props as Record<string, unknown>, api.context);
      const cleaned = helpers.stripUndefinedDeep(props as Record<string, unknown>);
      api.setWidgetState('array', cleaned);
    });

    const tree = (
      <Scene>
        <ArrayNode
          values={[1, () => 2]}
          nested={{ a: undefined, b: undefined }}
        />
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, makeContext(), new WidgetRegistry());
    expect(frame.widgets['array']).toEqual({ values: [1, 2] });
  });

  it('pushes annotations and labels through handlers', () => {
    registerNode(Scene, (node, api, helpers) => {
      helpers.compileChildren(node, api);
    });

    const Annot = () => null;
    const Label = () => null;
    registerNode(Annot, (_node, api) => {
      api.pushAnnotation({
        id: 'a1',
        label: 'A',
        placement: { mode: 'fixed', reference: { x: 'left', y: 'top' }, offset: { xPct: 0, yPct: 0 } },
      });
    });
    registerNode(Label, (_node, api) => {
      api.pushLabel({ id: 'l1', text: 'L', targetPartId: 'head' });
    });

    const tree = (
      <Scene>
        <Annot />
        <Label />
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, makeContext(), new WidgetRegistry());
    expect(frame.annotations?.[0].id).toBe('a1');
    expect(frame.labels?.[0].id).toBe('l1');
  });

  it('ignores function children that expand to non-elements', () => {
    registerNode(Scene, (node, api, helpers) => {
      helpers.compileChildren(node, api);
    });
    const Wrapper = () => 'text';
    const tree = (
      <Scene>
        <Wrapper />
      </Scene>
    );
    const { frame } = resolveSceneFromDsl(tree, makeContext(), new WidgetRegistry());
    expect(frame.widgets).toEqual({});
  });

  it('throws when tree is not a React element', () => {
    expect(() => resolveSceneFromDsl(null, makeContext(), new WidgetRegistry())).toThrow('Scene DSL must return');
  });

  it('throws when root is not <Scene>', () => {
    const Other = () => null;
    const tree = <Other />;
    expect(() => resolveSceneFromDsl(tree, makeContext(), new WidgetRegistry())).toThrow('Scene DSL root must be <Scene>');
  });
});
