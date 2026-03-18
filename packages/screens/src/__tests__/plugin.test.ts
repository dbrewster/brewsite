// Tests for screensPlugin — verifies lazy widget creation and node handler registration.

import { describe, it, expect, beforeEach } from 'vitest';
import { WidgetRegistry, getNodeHandler } from '@brewsite/core';
import { clearRegistry } from '@brewsite/core/compiler/registry';
import type { CompileApi } from '@brewsite/core';
import { screensPlugin } from '../plugin';
import { Screen, ScreenWidget } from '../elements/screen/widget';
import { MediaScreen, MediaScreenWidget } from '../elements/media-screen/widget';
import { ImagePanel, ImagePanelWidget } from '../elements/image-panel/widget';
import type { ReactElement } from 'react';

/** Minimal CompileApi that captures setWidgetState calls. */
function buildTestApi(): CompileApi & { captured: Record<string, unknown> } {
  const captured: Record<string, unknown> = {};
  return {
    context: {
      sceneIndex: 0,
      numScenes: 1,
      assetsReady: false,
      themeFamily: 'default',
      themePolarity: 'dark',
    } as CompileApi['context'],
    state: { id: '', scrollProgress: 0, widgets: {} },
    setWidgetState(widgetId: string, state: unknown) {
      captured[widgetId] = state;
      this.state.widgets[widgetId] = state;
    },
    setSceneMeta: () => {},
    pushWarning: () => {},
    composeBounds: (r) => r,
    composeZ: (z) => z,
    composeOpacity: (o) => o,
    pushOverlay: () => {},
    layoutContext: undefined,
    withLayoutContext(ctx) { return { ...this, layoutContext: ctx }; },
    captured,
  };
}

/** Minimal helpers stub. */
const testHelpers = {
  compileChildren: () => {},
  compileChildrenSeparated: () => [],
  resolveValue: <T,>(v: T) => v,
  resolveObjectValues: <T extends Record<string, unknown>>(v: T) => v,
  stripUndefinedDeep: <T extends Record<string, unknown>>(v: T) => v,
};

describe('screensPlugin', () => {
  let registry: WidgetRegistry;

  beforeEach(() => {
    clearRegistry();
    registry = new WidgetRegistry();
    const plugin = screensPlugin();
    plugin.configureRegistry!(registry);
  });

  it('registers a node handler for Screen', () => {
    const handler = getNodeHandler(Screen);
    expect(handler).toBeDefined();
  });

  it('registers a node handler for MediaScreen', () => {
    const handler = getNodeHandler(MediaScreen);
    expect(handler).toBeDefined();
  });

  it('registers a node handler for ImagePanel', () => {
    const handler = getNodeHandler(ImagePanel);
    expect(handler).toBeDefined();
  });

  it('lazily creates ScreenWidget on first DSL encounter', () => {
    // Before handler invocation, no widget exists.
    expect(registry.get('screen1')).toBeUndefined();

    const handler = getNodeHandler(Screen)!;
    const api = buildTestApi();
    const node = { type: Screen, props: { id: 'screen1', src: 'https://example.com' } } as unknown as ReactElement;
    handler(node, api, testHelpers as never);

    const widget = registry.get('screen1');
    expect(widget).toBeInstanceOf(ScreenWidget);
    expect(api.captured['screen1']).toBeDefined();
  });

  it('lazily creates MediaScreenWidget on first DSL encounter', () => {
    expect(registry.get('media1')).toBeUndefined();

    const handler = getNodeHandler(MediaScreen)!;
    const api = buildTestApi();
    const node = { type: MediaScreen, props: { id: 'media1' } } as unknown as ReactElement;
    handler(node, api, testHelpers as never);

    const widget = registry.get('media1');
    expect(widget).toBeInstanceOf(MediaScreenWidget);
    expect(api.captured['media1']).toBeDefined();
  });

  it('lazily creates ImagePanelWidget on first DSL encounter', () => {
    expect(registry.get('panel1')).toBeUndefined();

    const handler = getNodeHandler(ImagePanel)!;
    const api = buildTestApi();
    const node = { type: ImagePanel, props: { id: 'panel1', src: '/mockup.png' } } as unknown as ReactElement;
    handler(node, api, testHelpers as never);

    const widget = registry.get('panel1');
    expect(widget).toBeInstanceOf(ImagePanelWidget);
    expect(api.captured['panel1']).toBeDefined();
  });

  it('does not duplicate widget on second DSL encounter', () => {
    const handler = getNodeHandler(Screen)!;
    const api = buildTestApi();
    const node = { type: Screen, props: { id: 'screen1', src: 'https://example.com' } } as unknown as ReactElement;

    handler(node, api, testHelpers as never);
    const firstWidget = registry.get('screen1');

    handler(node, api, testHelpers as never);
    const secondWidget = registry.get('screen1');

    expect(firstWidget).toBe(secondWidget);
  });
});
