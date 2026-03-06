import { describe, it, expect, beforeEach } from 'vitest';
import React, { Fragment, isValidElement, type ReactElement } from 'react';
import { registerNode } from '../registry';
import { resolveSceneFromDsl, Scene, sceneRootHandler } from '../sceneDslCompiler';
import type { CompileApi, CompileHelpers } from '../sceneDslTypes';
import type { CompileWarning } from '../sceneTrackTypes';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import type { SceneSnapshotContext } from '../sceneTypes';
import { TextBox } from '../../elements/text-box';
import { ProgressManager } from '../primitives/progressManager';
import { resetCoreHandlerRegistrationForTesting } from '../coreHandlers';

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
      <Scene id="array">
        <ArrayNode
          values={[1, () => 2]}
          nested={{ a: undefined, b: undefined }}
        />
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, makeContext(), new WidgetRegistry());
    expect(frame.widgets['array']).toEqual({ values: [1, 2] });
  });

  it('ignores function children that expand to non-elements', () => {
    registerNode(Scene, (node, api, helpers) => {
      helpers.compileChildren(node, api);
    });
    const Wrapper = () => 'text';
    const tree = (
      <Scene id="wrapper">
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

  // ─── Overlay key regression tests ────────────────────────────────────────────
  // Ensure that TextBox elements preserve their React key through compilation so
  // EngineOverlayHost does not trigger "Each child in a list should have a unique
  // key prop" warnings.
  //
  // These tests use a nested describe with beforeEach to guarantee that the real
  // sceneRootHandler (which calls compileChildrenSeparated) is active for Scene.
  // Earlier tests in this file register a custom Scene handler; we reset and
  // re-register here so the overlay path is exercised correctly.

  describe('overlay key regression', () => {
    beforeEach(() => {
      // Reset the registration guard so ensureSceneRegistry inside
      // resolveSceneFromDsl will call registerCoreHandlers which re-registers
      // the real sceneRootHandler for Scene.
      resetCoreHandlerRegistrationForTesting();
      // Immediately re-register the real Scene handler directly so the guard
      // inside registerCoreHandlers (getNodeHandler check) sees it as absent.
      registerNode(Scene, sceneRootHandler);
    });

    it('stores a single TextBox as a Fragment-wrapped overlay element with its key intact', () => {
      const tree = (
        <Scene id="test">
          <TextBox key="tb1" x={0} y={0} w={1} h={1} />
        </Scene>
      );
      const { frame } = resolveSceneFromDsl(tree, makeContext(), new WidgetRegistry());
      expect(frame.sceneOverlay).toBeDefined();
      const overlay = frame.sceneOverlay as ReactElement;
      // Fix 2: sceneOverlay must be a Fragment, not a raw array.
      expect(isValidElement(overlay)).toBe(true);
      expect(overlay.type).toBe(Fragment);
      // Fix 1: the child inside the Fragment must be the original TextBox element,
      // not the unwrapped inner <div>, so the key survives.
      const child = overlay.props.children as ReactElement;
      expect(isValidElement(child)).toBe(true);
      expect(child.type).toBe(TextBox);
      expect(child.key).toBe('.$tb1');
    });

    it('two TextBox elements each carry distinct keys in the overlay Fragment', () => {
      const tree = (
        <Scene id="test">
          <TextBox key="tb1" x={0} y={0} w={0.5} h={1} />
          <TextBox key="tb2" x={0.5} y={0} w={0.5} h={1} />
        </Scene>
      );
      const { frame } = resolveSceneFromDsl(tree, makeContext(), new WidgetRegistry());
      expect(frame.sceneOverlay).toBeDefined();
      const overlay = frame.sceneOverlay as ReactElement;
      expect(overlay.type).toBe(Fragment);
      const children = overlay.props.children as ReactElement[];
      expect(Array.isArray(children)).toBe(true);
      expect(children).toHaveLength(2);
      const keys = children.map((c: ReactElement) => c.key);
      expect(keys[0]).toBe('.$tb1');
      expect(keys[1]).toBe('.$tb2');
      expect(new Set(keys).size).toBe(2);
    });

    it('compiles DSL children into widget state and routes TextBox to overlay', () => {
      const tree = (
        <Scene id="test">
          <ProgressManager scrollUnits={2} />
          <TextBox key="tb1" x={0.1} y={0.1} w={0.8} h={0.8} />
        </Scene>
      );
      const { frame } = resolveSceneFromDsl(tree, makeContext(), new WidgetRegistry());
      // ProgressManager writes to progressManager spec in the frame, not widgets;
      // verify the overlay contains only the TextBox (not ProgressManager).
      expect(frame.sceneOverlay).toBeDefined();
      const overlay = frame.sceneOverlay as ReactElement;
      expect(overlay.type).toBe(Fragment);
      const children = React.Children.toArray(overlay.props.children) as ReactElement[];
      expect(children).toHaveLength(1);
      expect(children[0].type).toBe(TextBox);
    });

    it('direct div children appear in the overlay Fragment', () => {
      const tree = (
        <Scene id="test">
          <div key="d1" className="hero">Hello</div>
        </Scene>
      );
      const { frame } = resolveSceneFromDsl(tree, makeContext(), new WidgetRegistry());
      expect(frame.sceneOverlay).toBeDefined();
      const overlay = frame.sceneOverlay as ReactElement;
      expect(overlay.type).toBe(Fragment);
      const child = overlay.props.children as ReactElement;
      expect(isValidElement(child)).toBe(true);
      expect(child.type).toBe('div');
    });
  });

  // ─── MISSING_KEY warning tests ────────────────────────────────────────────────
  // These tests verify that keyless overlay elements produce a MISSING_KEY warning
  // with an elementAncestry chain. NODE_ENV=test (set by Vitest) satisfies the
  // process.env.NODE_ENV !== 'production' guard.

  describe('MISSING_KEY warnings', () => {
    beforeEach(() => {
      resetCoreHandlerRegistrationForTesting();
      registerNode(Scene, sceneRootHandler);
    });

    it('emits a MISSING_KEY warning for a keyless div child', () => {
      const warnings: CompileWarning[] = [];
      const tree = (
        <Scene id="test">
          <div>hello</div>
        </Scene>
      );
      resolveSceneFromDsl(
        tree,
        { sceneIndex: 0, numScenes: 1, assetsReady: true },
        new WidgetRegistry(),
        (w) => warnings.push(w),
      );
      expect(warnings.some((w) => w.code === 'MISSING_KEY')).toBe(true);
    });

    it('MISSING_KEY warning includes a non-empty elementAncestry with Scene entry', () => {
      const warnings: CompileWarning[] = [];
      const tree = (
        <Scene id="test">
          <div>hello</div>
        </Scene>
      );
      resolveSceneFromDsl(
        tree,
        { sceneIndex: 0, numScenes: 1, assetsReady: true },
        new WidgetRegistry(),
        (w) => warnings.push(w),
      );
      const missingKeyWarning = warnings.find((w) => w.code === 'MISSING_KEY');
      expect(missingKeyWarning).toBeDefined();
      expect(missingKeyWarning!.elementAncestry).toBeDefined();
      expect(missingKeyWarning!.elementAncestry!.length).toBeGreaterThan(0);
      expect(
        missingKeyWarning!.elementAncestry!.some((b) => b.componentName === 'Scene'),
      ).toBe(true);
    });

    it('does NOT emit MISSING_KEY for a TextBox with an id key', () => {
      const warnings: CompileWarning[] = [];
      const tree = (
        <Scene id="test">
          <TextBox key="tb1" x={0} y={0} w={1} h={1} />
        </Scene>
      );
      resolveSceneFromDsl(
        tree,
        { sceneIndex: 0, numScenes: 1, assetsReady: true },
        new WidgetRegistry(),
        (w) => warnings.push(w),
      );
      expect(warnings.some((w) => w.code === 'MISSING_KEY')).toBe(false);
    });

    it('breadcrumbs from one compilation do not leak into a subsequent compilation', () => {
      const warnings1: CompileWarning[] = [];
      const warnings2: CompileWarning[] = [];

      const tree1 = (
        <Scene id="first">
          <div>keyless in first</div>
        </Scene>
      );
      const tree2 = (
        <Scene id="second">
          <div key="d2">keyed in second</div>
        </Scene>
      );

      resolveSceneFromDsl(
        tree1,
        { sceneIndex: 0, numScenes: 2, assetsReady: true },
        new WidgetRegistry(),
        (w) => warnings1.push(w),
      );
      resolveSceneFromDsl(
        tree2,
        { sceneIndex: 1, numScenes: 2, assetsReady: true },
        new WidgetRegistry(),
        (w) => warnings2.push(w),
      );

      // First compilation emits a MISSING_KEY warning
      expect(warnings1.some((w) => w.code === 'MISSING_KEY')).toBe(true);
      // Second compilation (keyed element) emits no MISSING_KEY warning
      expect(warnings2.some((w) => w.code === 'MISSING_KEY')).toBe(false);
      // The second compilation's ancestry does not reference the first compilation's sceneIndex
      const w2Ancestry = warnings2.flatMap((w) => w.elementAncestry ?? []);
      expect(w2Ancestry.every((b) => b.componentName !== 'first')).toBe(true);
    });
  });
});
