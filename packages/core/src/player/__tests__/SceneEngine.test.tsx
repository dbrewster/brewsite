// @vitest-environment jsdom
// SceneEngine tests — verifies plugin resolution, context provision, zero-scene mode.

import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import React, { useContext } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { SceneEngine } from '../SceneEngine';
import { EngineContext } from '../EngineContext';
import { PluginInheritanceContext } from '../PluginInheritanceContext';
import type { WidgetPlugin } from '../../widget/WidgetPlugin';

afterEach(() => cleanup());

// ─── JSDOM browser API stubs ──────────────────────────────────────────────────
// useSceneEngine internally uses matchMedia (prefersReducedMotion) and RAF.

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => false,
    media: '',
    onchange: null,
  }));
  window.requestAnimationFrame = vi.fn().mockReturnValue(1);
  window.cancelAnimationFrame = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Test doubles ──────────────────────────────────────────────────────────────

/**
 * Builds a minimal WidgetPlugin test double. Satisfies the WidgetPlugin interface.
 */
const makePlugin = (): WidgetPlugin => ({
  registerHandlers: vi.fn(),
  createWidgets: vi.fn().mockReturnValue([]),
  configureRegistry: vi.fn(),
  wrapProvider: undefined,
});

/**
 * A consumer that reads from EngineContext and exposes the engine via callback.
 */
function EngineConsumer({ onEngine }: { onEngine: (engine: unknown) => void }): React.ReactElement {
  const engine = useContext(EngineContext);
  onEngine(engine);
  return <div data-testid="consumer" />;
}

/**
 * A consumer that reads PluginInheritanceContext.
 */
function PluginConsumer({
  onPlugins,
}: {
  onPlugins: (plugins: WidgetPlugin[] | null) => void;
}): React.ReactElement {
  const plugins = useContext(PluginInheritanceContext);
  onPlugins(plugins as WidgetPlugin[] | null);
  return <div data-testid="plugin-consumer" />;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SceneEngine', () => {
  it('renders without extra DOM wrapper nodes (context providers only)', () => {
    const plugin = makePlugin();
    const { container } = render(
      <SceneEngine plugins={[plugin]}>
        <div data-testid="child">child</div>
      </SceneEngine>,
    );
    // SceneEngine context providers don't add DOM nodes — only the child appears
    expect(screen.getByTestId('child')).not.toBeNull();
    expect(container.firstChild).toBe(screen.getByTestId('child'));
  });

  it('provides EngineContext — child can read a non-null engine', () => {
    const plugin = makePlugin();
    let capturedEngine: unknown = undefined;
    render(
      <SceneEngine plugins={[plugin]}>
        <EngineConsumer onEngine={(e) => { capturedEngine = e; }} />
      </SceneEngine>,
    );
    expect(capturedEngine).not.toBeNull();
    expect(capturedEngine).not.toBeUndefined();
  });

  it('own plugins prop overrides ancestor PluginInheritanceContext', () => {
    const inheritedPlugin = makePlugin();
    const ownPlugin = makePlugin();
    let capturedPlugins: WidgetPlugin[] | null = null;

    render(
      <PluginInheritanceContext.Provider value={[inheritedPlugin]}>
        <SceneEngine plugins={[ownPlugin]}>
          <PluginConsumer onPlugins={(p) => { capturedPlugins = p; }} />
        </SceneEngine>
      </PluginInheritanceContext.Provider>,
    );

    expect(capturedPlugins).not.toBeNull();
    expect(capturedPlugins).toHaveLength(1);
    // Own plugin should have been invoked; inherited one should not
    expect(ownPlugin.registerHandlers).toHaveBeenCalled();
    expect(inheritedPlugin.registerHandlers).not.toHaveBeenCalled();
  });

  it('inherits plugins from nearest ancestor SceneEngine when plugins prop is omitted', () => {
    const parentPlugin = makePlugin();
    let childPlugins: WidgetPlugin[] | null = null;

    render(
      <SceneEngine plugins={[parentPlugin]}>
        {/* No plugins prop — should inherit via PluginInheritanceContext */}
        <SceneEngine>
          <PluginConsumer onPlugins={(p) => { childPlugins = p; }} />
        </SceneEngine>
      </SceneEngine>,
    );

    // Child's resolved plugins come from the parent's PluginInheritanceContext
    expect(childPlugins).not.toBeNull();
    expect(childPlugins).toHaveLength(1);
  });

  it('logs console.error when no plugins and no ancestor provides them', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <SceneEngine>
        <div />
      </SceneEngine>,
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[BrewSite] <SceneEngine>'),
    );
  });

  it('mounts in zero-scene mode (no <Scene> children) without error', () => {
    const plugin = makePlugin();
    let capturedEngine: unknown = undefined;
    expect(() => {
      render(
        <SceneEngine plugins={[plugin]}>
          <EngineConsumer onEngine={(e) => { capturedEngine = e; }} />
        </SceneEngine>,
      );
    }).not.toThrow();

    expect(capturedEngine).not.toBeNull();
    const engine = capturedEngine as { sceneCount: number };
    expect(engine.sceneCount).toBe(0);
  });

  it('forwards onCompileWarning prop to engine without throwing', () => {
    const plugin = makePlugin();
    const onCompileWarning = vi.fn();
    expect(() => {
      render(
        <SceneEngine plugins={[plugin]} onCompileWarning={onCompileWarning}>
          <div />
        </SceneEngine>,
      );
    }).not.toThrow();
  });
});
