// Tests for enforceSceneChildConstraint — interface-based stateful tests.
// Asserts real SceneFrame output from resolveSceneFromDsl for each constraint scenario.

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerCoreHandlers, resetCoreHandlerRegistrationForTesting } from '../coreHandlers';
import { clearRegistry, registerNode } from '../registry';
import { resolveSceneFromDsl, Scene } from '../sceneDslCompiler';
import { View } from '../blocks/viewDsl';
import { ViewLayout } from '../blocks/viewLayoutDsl';
import { WidgetRegistry } from '../../widget/WidgetRegistry';

// A minimal spatial DSL component for testing
const SpatialWidget = () => null;
SpatialWidget.displayName = 'SpatialWidget';

// A second spatial component for multi-spatial tests
const SpatialWidget2 = () => null;
SpatialWidget2.displayName = 'SpatialWidget2';

// A minimal ambient DSL component for testing
const AmbientWidget = () => null;
AmbientWidget.displayName = 'AmbientWidget';

const CONTEXT = {
  sceneIndex: 0,
  numScenes: 1,
  assetsReady: true,
};

// Use a real WidgetRegistry — the constraint enforcement doesn't use it at
// compile time, but resolveSceneFromDsl requires it as a parameter.
const registry = new WidgetRegistry();

beforeEach(() => {
  clearRegistry();
  resetCoreHandlerRegistrationForTesting();
  registerCoreHandlers();
  // Register test widgets — spatial is the default (no category)
  registerNode(SpatialWidget, (node, api) => {
    api.setWidgetState('spatial-test', { compiled: true });
  });
  registerNode(SpatialWidget2, (node, api) => {
    api.setWidgetState('spatial-test-2', { compiled: true });
  });
  // Register ambient test widget — writes state so we can verify it compiles on error paths
  registerNode(AmbientWidget, (node, api) => {
    api.setWidgetState('ambient-test', { compiled: true });
  }, { category: 'ambient' });
});

function compile(jsx: React.ReactElement) {
  return resolveSceneFromDsl(jsx, CONTEXT, registry);
}

// ─── Auto-wrap: single spatial child ─────────────────────────────────────────

it('auto-wraps a single spatial child in a fullscreen implicit View', () => {
  const result = compile(
    <Scene id="s1">
      <SpatialWidget />
    </Scene>
  );
  // ViewState for the implicit view should be in the compiled output
  const viewState = result.frame.widgets['__scene_root__'];
  expect(viewState).toBeDefined();
  expect(viewState).toMatchObject({ id: '__scene_root__', bounds: { x: 0, y: 0, w: 1, h: 1 } });
  // The spatial widget's state should also be present (compiled through viewHandler)
  expect(result.frame.widgets['spatial-test']).toEqual({ compiled: true });
});

// ─── Auto-wrap: single spatial child + ambient children coexist ───────────────

it('auto-wraps the spatial child and compiles ambient children normally', () => {
  const warnings: unknown[] = [];
  const result = resolveSceneFromDsl(
    <Scene id="s1">
      <AmbientWidget />
      <SpatialWidget />
    </Scene>,
    CONTEXT,
    registry,
    (w) => warnings.push(w),
  );
  expect(result.frame.widgets['__scene_root__']).toBeDefined();
  expect(result.frame.widgets['spatial-test']).toEqual({ compiled: true });
  expect(warnings).toHaveLength(0);
});

// ─── No spatial children — no auto-wrap, no error ────────────────────────────

it('compiles ambient-only scenes without creating an implicit View', () => {
  const result = compile(
    <Scene id="s1">
      <AmbientWidget />
    </Scene>
  );
  expect(result.frame.widgets['__scene_root__']).toBeUndefined();
  expect(result.frame.widgets).not.toMatchObject({ id: '__scene_root__' });
});

// ─── Multiple spatial children without Views — console.error, children skipped ─

it('emits console.error and skips all spatial children when multiple are present without Views', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const result = compile(
    <Scene id="s1">
      <SpatialWidget />
      <SpatialWidget />
    </Scene>
  );
  expect(errorSpy).toHaveBeenCalledOnce();
  expect(errorSpy.mock.calls[0]![0]).toContain('Multiple spatial elements');
  expect(result.frame.widgets['spatial-test']).toBeUndefined();
  errorSpy.mockRestore();
});

// ─── Mixed mode — spatial child alongside explicit View — console.error, spatial skipped ─

it('emits console.error when a spatial child is alongside a View child', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const result = compile(
    <Scene id="s1">
      <View id="v1"><SpatialWidget /></View>
      <SpatialWidget />
    </Scene>
  );
  expect(errorSpy).toHaveBeenCalledOnce();
  expect(errorSpy.mock.calls[0]![0]).toContain('cannot be direct <Scene> children');
  errorSpy.mockRestore();
});

// ─── Explicit single View — spatial child inside View compiles correctly ──────

it('compiles a spatial child inside an explicit View without errors', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const result = compile(
    <Scene id="s1">
      <View id="main" x={0} y={0} w={'100%'} h={'100%'}>
        <SpatialWidget />
      </View>
    </Scene>
  );
  expect(errorSpy).not.toHaveBeenCalled();
  expect(result.frame.widgets['main']).toBeDefined();
  expect(result.frame.widgets['spatial-test']).toEqual({ compiled: true });
  errorSpy.mockRestore();
});

// ─── ViewLayout as direct Scene child is valid explicit-view mode ─────────────

it('accepts ViewLayout as a direct Scene child without error', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  compile(
    <Scene id="s1">
      <ViewLayout kind="stack">
        <View id="a"><SpatialWidget /></View>
        <View id="b"><SpatialWidget /></View>
      </ViewLayout>
    </Scene>
  );
  expect(errorSpy).not.toHaveBeenCalled();
  errorSpy.mockRestore();
});

// ─── Multiple sibling Views without ViewLayout — valid ────────────────────────

it('accepts multiple sibling Views as direct Scene children', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  compile(
    <Scene id="s1">
      <View id="left" x={0} y={0} w={'50%'} h={'100%'}><SpatialWidget /></View>
      <View id="right" x={'50%'} y={0} w={'50%'} h={'100%'}><SpatialWidget /></View>
    </Scene>
  );
  expect(errorSpy).not.toHaveBeenCalled();
  errorSpy.mockRestore();
});

// ─── TextBox-like ambient alongside spatial child — valid, no error ───────────

it('compiles a TextBox alongside a spatial child without error (TextBox is ambient)', () => {
  // TextBox is registered as ambient via its widget nodeHandlerCategory.
  // In this test we simulate this by registering a TextBox-like ambient component.
  const TextBoxLike = () => null;
  TextBoxLike.displayName = 'TextBoxLike';
  registerNode(TextBoxLike, () => {}, { category: 'ambient' });

  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const result = compile(
    <Scene id="s1">
      <SpatialWidget />
      <TextBoxLike />
    </Scene>
  );
  // Only one spatial child — auto-wrapped; TextBoxLike compiled as ambient
  expect(result.frame.widgets['__scene_root__']).toBeDefined();
  expect(errorSpy).not.toHaveBeenCalled();
  errorSpy.mockRestore();
});

// ─── (Post-review v2) Empty Scene — no children ───────────────────────────────

it('compiles an empty Scene without errors or implicit View', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const result = compile(<Scene id="s1" />);
  expect(errorSpy).not.toHaveBeenCalled();
  expect(result.frame.widgets['__scene_root__']).toBeUndefined();
  errorSpy.mockRestore();
});

// ─── (Post-review v2) HTML overlay as direct Scene child — not classified as spatial ─

it('does not classify HTML elements as spatial children', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const result = compile(
    <Scene id="s1">
      <SpatialWidget />
      <div key="overlay">Hello</div>
    </Scene>
  );
  // Single spatial child + HTML overlay → auto-wrap fires, no error
  expect(errorSpy).not.toHaveBeenCalled();
  expect(result.frame.widgets['__scene_root__']).toBeDefined();
  expect(result.frame.widgets['spatial-test']).toEqual({ compiled: true });
  errorSpy.mockRestore();
});

// ─── (Post-review v2) Fragment-wrapped spatial child — auto-wrapped correctly ──

it('auto-wraps a spatial child inside a Fragment', () => {
  const result = compile(
    <Scene id="s1">
      <>{<SpatialWidget />}</>
    </Scene>
  );
  expect(result.frame.widgets['__scene_root__']).toBeDefined();
  expect(result.frame.widgets['spatial-test']).toEqual({ compiled: true });
});

// ─── (Post-review v2) Multiple spatial children inside Fragments — error emitted ─

it('emits error for multiple spatial children across Fragments', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  compile(
    <Scene id="s1">
      <><SpatialWidget /></>
      <><SpatialWidget2 /></>
    </Scene>
  );
  expect(errorSpy).toHaveBeenCalledOnce();
  expect(errorSpy.mock.calls[0]![0]).toContain('Multiple spatial elements');
  errorSpy.mockRestore();
});

// ─── (Post-review v2) Ambient children still compile when spatial children are errored ─

it('preserves ambient widget state when spatial children are errored and skipped', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const result = compile(
    <Scene id="s1">
      <AmbientWidget />
      <SpatialWidget />
      <SpatialWidget2 />
    </Scene>
  );
  // Multiple spatial children → error, spatial skipped
  expect(errorSpy).toHaveBeenCalledOnce();
  // But ambient widget state is preserved — the scene skeleton compiles
  expect(result.frame.widgets['ambient-test']).toEqual({ compiled: true });
  // Spatial widgets were not compiled
  expect(result.frame.widgets['spatial-test']).toBeUndefined();
  expect(result.frame.widgets['spatial-test-2']).toBeUndefined();
  errorSpy.mockRestore();
});

// ─── (Post-review v2) Function-component wrapper around spatial element — treated as opaque ─

it('treats function-component wrappers as opaque (shallow collection)', () => {
  // The constraint uses collectChildrenShallow — it does NOT expand function components.
  // A wrapper is seen as a single non-registered child, not as its expanded spatial output.
  const Wrapper = () => React.createElement(SpatialWidget);
  Wrapper.displayName = 'Wrapper';

  // Wrapper is not registered → not classified as spatial by the constraint.
  // This test documents the shallow-only behavior.
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  compile(<Scene id="s1"><Wrapper /></Scene>);
  // No error — the wrapper is expanded during normal compilation, not during constraint.
  expect(errorSpy).not.toHaveBeenCalled();
  errorSpy.mockRestore();
});

// ─── (Post-review v2) Unregistered component alongside explicit View — treated as overlay ─
// Note: the implementation guards with isPrimitiveComponent before checking category.
// Unregistered function components are treated as overlay content (not spatial),
// so they do NOT trigger the mixed-mode error even when Views are present.

it('treats unregistered function components as overlay content, not spatial', () => {
  const UnknownWidget = () => null;
  UnknownWidget.displayName = 'UnknownWidget';
  // NOT registered — isPrimitiveComponent returns false, treated as overlay content

  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  compile(
    <Scene id="s1">
      <View id="v1"><SpatialWidget /></View>
      <UnknownWidget />
    </Scene>
  );
  // UnknownWidget is overlay content — not a mixed-mode error
  expect(errorSpy).not.toHaveBeenCalled();
  errorSpy.mockRestore();
});
