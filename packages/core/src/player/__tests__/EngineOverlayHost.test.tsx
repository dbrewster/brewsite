// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { EngineOverlayHost } from '../EngineOverlayHost';
import { EngineStateContext } from '../EngineStateContext';
import { ThemeContext } from '../../theme/ThemeContext';
import { VariableStoreContext } from '../../widget/VariableStoreContext';
import { VariableStore } from '../../widget/VariableStore';
import { TextBoxChildrenContext } from '../TextBoxChildrenContext';
import { TEXTBOX_NAMESPACE } from '../../elements/text-box';
import type { SceneTheme } from '../../theme/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Populates a VariableStore with TextBox layout state for one widget.
 * Mirrors the write path in TextBoxWidget.apply().
 */
function populateTextBoxState(
  store: VariableStore,
  widgetId: string,
  state: {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    opacity?: number;
    anchor?: string;
    edge?: string | null;
    inset?: number;
    overflow?: string;
    layer?: number;
  },
): void {
  store.set(TEXTBOX_NAMESPACE, `${widgetId}.x`, state.x ?? 0);
  store.set(TEXTBOX_NAMESPACE, `${widgetId}.y`, state.y ?? 0);
  store.set(TEXTBOX_NAMESPACE, `${widgetId}.w`, state.w ?? 1);
  store.set(TEXTBOX_NAMESPACE, `${widgetId}.h`, state.h ?? 1);
  store.set(TEXTBOX_NAMESPACE, `${widgetId}.opacity`, state.opacity ?? 1);
  store.set(TEXTBOX_NAMESPACE, `${widgetId}.anchor`, state.anchor ?? 'scene');
  store.set(TEXTBOX_NAMESPACE, `${widgetId}.edge`, state.edge ?? null);
  store.set(TEXTBOX_NAMESPACE, `${widgetId}.inset`, state.inset ?? 0);
  store.set(TEXTBOX_NAMESPACE, `${widgetId}.overflow`, state.overflow ?? 'hidden');
  store.set(TEXTBOX_NAMESPACE, `${widgetId}.layer`, state.layer ?? 0);
}

const makeTestTheme = (overrides?: Partial<SceneTheme>): SceneTheme => ({
  colorMode: 'dark',
  font: { htmlFamily: 'Inter, sans-serif' },
  fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
  ...overrides,
});

/**
 * Renders EngineOverlayHost with the provided VariableStore, children map,
 * optional overlay transition config, and optional theme.
 */
const renderHost = (options: {
  variableStore?: VariableStore;
  childrenMap?: Map<string, React.ReactNode>;
  transition?: React.ComponentProps<typeof EngineOverlayHost>['overlayTransition'];
  theme?: SceneTheme | null;
  passthroughPointerEvents?: boolean;
} = {}) => {
  const {
    variableStore = new VariableStore(),
    childrenMap = new Map(),
    transition,
    theme,
    passthroughPointerEvents,
  } = options;

  const inner = (
    <EngineStateContext.Provider
      value={{ progress: 0, sceneId: 'scene-a', sceneIndex: 0, sceneProgress: 0 }}
    >
      <VariableStoreContext.Provider value={variableStore}>
        <TextBoxChildrenContext.Provider value={childrenMap}>
          <EngineOverlayHost
            overlayTransition={transition}
            passthroughPointerEvents={passthroughPointerEvents}
          />
        </TextBoxChildrenContext.Provider>
      </VariableStoreContext.Provider>
    </EngineStateContext.Provider>
  );

  return render(
    theme !== undefined
      ? <ThemeContext.Provider value={theme}>{inner}</ThemeContext.Provider>
      : inner,
  );
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EngineOverlayHost', () => {
  afterEach(() => {
    cleanup();
  });

  // ─── Transition animation ────────────────────────────────────────────────────

  it('applies default transition style on the overlay container', () => {
    const view = renderHost();
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.animation).toContain('brewsite-overlay-enter 200ms ease-out');
  });

  it('supports disabling transition animation', () => {
    const view = renderHost({ transition: { enabled: false } });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.animation).toBe('');
  });

  it('applies configured transition duration and easing', () => {
    const view = renderHost({ transition: { durationMs: 350, easing: 'linear' } });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.animation).toContain('brewsite-overlay-enter 350ms linear');
  });

  // ─── TextBox with anchor='scene' ─────────────────────────────────────────────

  it('renders a TextBox with anchor="scene" as position:absolute with correct NVS percentages', () => {
    const store = new VariableStore();
    populateTextBoxState(store, 'panel', { x: 0.05, y: 0.1, w: 0.4, h: 0.8, anchor: 'scene' });
    const childrenMap = new Map<string, React.ReactNode>([['panel', <span key="c">Panel content</span>]]);

    const view = renderHost({ variableStore: store, childrenMap });

    const panel = view.getByText('Panel content').parentElement as HTMLDivElement;
    expect(panel.style.position).toBe('absolute');
    expect(panel.style.left).toBe('5%');
    expect(panel.style.top).toBe('10%');
    expect(panel.style.width).toBe('40%');
    expect(panel.style.height).toBe('80%');
  });

  it('renders a TextBox with anchor="scene" at x=0 y=0 w=1 h=1 (fullscreen defaults)', () => {
    const store = new VariableStore();
    populateTextBoxState(store, 'full', { x: 0, y: 0, w: 1, h: 1, anchor: 'scene' });
    const childrenMap = new Map<string, React.ReactNode>([['full', <span key="c">Full</span>]]);

    const view = renderHost({ variableStore: store, childrenMap });

    const panel = view.getByText('Full').parentElement as HTMLDivElement;
    expect(panel.style.position).toBe('absolute');
    expect(panel.style.left).toBe('0%');
    expect(panel.style.top).toBe('0%');
    expect(panel.style.width).toBe('100%');
    expect(panel.style.height).toBe('100%');
  });

  it('applies opacity and zIndex on the scene-anchored TextBox div', () => {
    const store = new VariableStore();
    populateTextBoxState(store, 'faded', { opacity: 0.5, layer: 3, anchor: 'scene' });
    const childrenMap = new Map<string, React.ReactNode>([['faded', <span key="c">Faded</span>]]);

    const view = renderHost({ variableStore: store, childrenMap });

    const panel = view.getByText('Faded').parentElement as HTMLDivElement;
    expect(panel.style.opacity).toBe('0.5');
    expect(panel.style.zIndex).toBe('3');
  });

  it('applies overflow="visible" on the scene-anchored TextBox div', () => {
    const store = new VariableStore();
    populateTextBoxState(store, 'vis', { overflow: 'visible', anchor: 'scene' });
    const childrenMap = new Map<string, React.ReactNode>([['vis', <span key="c">Visible</span>]]);

    const view = renderHost({ variableStore: store, childrenMap });

    const panel = view.getByText('Visible').parentElement as HTMLDivElement;
    expect(panel.style.overflow).toBe('visible');
  });

  // ─── TextBox with anchor='viewport' ──────────────────────────────────────────

  it('renders a TextBox with anchor="viewport" edge="top" as position:fixed with top inset', () => {
    const store = new VariableStore();
    populateTextBoxState(store, 'banner', {
      anchor: 'viewport',
      edge: 'top',
      inset: 0.05,
      opacity: 1,
      layer: 20,
      overflow: 'hidden',
    });
    const childrenMap = new Map<string, React.ReactNode>([['banner', <span key="c">Banner</span>]]);

    const view = renderHost({ variableStore: store, childrenMap });

    const panel = view.getByText('Banner').parentElement as HTMLDivElement;
    expect(panel.style.position).toBe('fixed');
    expect(panel.style.top).toBe('5%');
    expect(panel.style.left).toBe('0px');
    expect(panel.style.right).toBe('0px');
  });

  it('renders a TextBox with anchor="viewport" edge="bottom" as position:fixed with bottom inset', () => {
    const store = new VariableStore();
    populateTextBoxState(store, 'footer', {
      anchor: 'viewport',
      edge: 'bottom',
      inset: 0.1,
    });
    const childrenMap = new Map<string, React.ReactNode>([['footer', <span key="c">Footer</span>]]);

    const view = renderHost({ variableStore: store, childrenMap });

    const panel = view.getByText('Footer').parentElement as HTMLDivElement;
    expect(panel.style.position).toBe('fixed');
    expect(panel.style.bottom).toBe('10%');
    expect(panel.style.left).toBe('0px');
    expect(panel.style.right).toBe('0px');
  });

  it('renders a TextBox with anchor="viewport" edge="left" as position:fixed spanning full height', () => {
    const store = new VariableStore();
    populateTextBoxState(store, 'sidebar', {
      anchor: 'viewport',
      edge: 'left',
      inset: 0,
    });
    const childrenMap = new Map<string, React.ReactNode>([['sidebar', <span key="c">Sidebar</span>]]);

    const view = renderHost({ variableStore: store, childrenMap });

    const panel = view.getByText('Sidebar').parentElement as HTMLDivElement;
    expect(panel.style.position).toBe('fixed');
    expect(panel.style.left).toBe('0%');
    expect(panel.style.top).toBe('0px');
    expect(panel.style.bottom).toBe('0px');
  });

  it('renders a TextBox with anchor="viewport" edge="right" as position:fixed spanning full height', () => {
    const store = new VariableStore();
    populateTextBoxState(store, 'right-panel', {
      anchor: 'viewport',
      edge: 'right',
      inset: 0.02,
    });
    const childrenMap = new Map<string, React.ReactNode>([
      ['right-panel', <span key="c">Right panel</span>],
    ]);

    const view = renderHost({ variableStore: store, childrenMap });

    const panel = view.getByText('Right panel').parentElement as HTMLDivElement;
    expect(panel.style.position).toBe('fixed');
    expect(panel.style.right).toBe('2%');
    expect(panel.style.top).toBe('0px');
    expect(panel.style.bottom).toBe('0px');
  });

  it('falls back to position:fixed top-0 left-0 right-0 when edge is undefined', () => {
    const store = new VariableStore();
    populateTextBoxState(store, 'noedge', {
      anchor: 'viewport',
      edge: null,
      inset: 0,
    });
    const childrenMap = new Map<string, React.ReactNode>([['noedge', <span key="c">No edge</span>]]);

    const view = renderHost({ variableStore: store, childrenMap });

    const panel = view.getByText('No edge').parentElement as HTMLDivElement;
    expect(panel.style.position).toBe('fixed');
    expect(panel.style.top).toBe('0px');
    expect(panel.style.left).toBe('0px');
    expect(panel.style.right).toBe('0px');
  });

  // ─── Multiple TextBox widgets ─────────────────────────────────────────────────

  it('renders multiple TextBox widgets as separate positioned divs', () => {
    const store = new VariableStore();
    populateTextBoxState(store, 'left', { x: 0, y: 0, w: 0.5, h: 1, anchor: 'scene' });
    populateTextBoxState(store, 'right', { x: 0.5, y: 0, w: 0.5, h: 1, anchor: 'scene' });
    const childrenMap = new Map<string, React.ReactNode>([
      ['left', <span key="l">Left panel</span>],
      ['right', <span key="r">Right panel</span>],
    ]);

    const view = renderHost({ variableStore: store, childrenMap });

    const leftDiv = view.getByText('Left panel').parentElement as HTMLDivElement;
    const rightDiv = view.getByText('Right panel').parentElement as HTMLDivElement;
    expect(leftDiv.style.width).toBe('50%');
    expect(rightDiv.style.left).toBe('50%');
  });

  it('renders no TextBox divs when the VariableStore has no textbox namespace entries', () => {
    const view = renderHost();
    const overlay = view.container.firstChild as HTMLDivElement;
    // Overlay always renders; just has no TextBox children
    expect(overlay.children).toHaveLength(0);
  });

  // ─── Theme CSS variable injection ────────────────────────────────────────────

  it('injects no CSS custom properties when no theme is provided', () => {
    const view = renderHost({ theme: null });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-font-family')).toBe('');
    expect(overlay.style.getPropertyValue('--brewsite-color-mode')).toBe('');
    expect(overlay.style.getPropertyValue('--brewsite-font-size-heading')).toBe('');
  });

  it('sets --brewsite-font-family when theme is present', () => {
    const theme = makeTestTheme();
    const view = renderHost({ theme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-font-family')).toBe('Inter, sans-serif');
  });

  it('sets fontFamily inline style to var(--brewsite-font-family) when theme is present', () => {
    const theme = makeTestTheme();
    const view = renderHost({ theme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.fontFamily).toBe('var(--brewsite-font-family)');
  });

  it('sets all 5 font-size variables in calc(1rem * X) format', () => {
    const theme = makeTestTheme();
    const view = renderHost({ theme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-font-size-heading')).toBe('calc(1rem * 1.5)');
    expect(overlay.style.getPropertyValue('--brewsite-font-size-body')).toBe('calc(1rem * 1)');
    expect(overlay.style.getPropertyValue('--brewsite-font-size-label')).toBe('calc(1rem * 0.85)');
    expect(overlay.style.getPropertyValue('--brewsite-font-size-caption')).toBe('calc(1rem * 0.7)');
    expect(overlay.style.getPropertyValue('--brewsite-font-size-annotation')).toBe('calc(1rem * 0.6)');
  });

  it('sets --brewsite-text-primary to #ffffff for dark colorMode', () => {
    const theme = makeTestTheme({ colorMode: 'dark' });
    const view = renderHost({ theme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-text-primary')).toBe('#ffffff');
  });

  it('sets --brewsite-text-primary to #111111 for light colorMode', () => {
    const theme = makeTestTheme({ colorMode: 'light' });
    const view = renderHost({ theme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-text-primary')).toBe('#111111');
  });

  it('does NOT set --brewsite-accent-color when accentColor is undefined', () => {
    const theme = makeTestTheme({ accentColor: undefined });
    const view = renderHost({ theme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-accent-color')).toBe('');
  });

  it('sets --brewsite-accent-color when accentColor is defined', () => {
    const theme = makeTestTheme({ accentColor: '#6b48ff' });
    const view = renderHost({ theme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-accent-color')).toBe('#6b48ff');
  });
});
