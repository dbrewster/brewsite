import { describe, it, expect } from 'vitest';
import { WidgetRegistry, isInputDefaultProvider } from '../WidgetRegistry';
import type { IWidget, IInputDefaultProvider } from '../types';
import type { InputActionSpec } from '../../input/types';

// Minimal test double implementing IWidget only (no IInputDefaultProvider)
const makeBasicWidget = (id: string): IWidget => ({ widgetId: id });

// Minimal test double implementing IInputDefaultProvider
const makeProviderWidget = (id: string, actions: InputActionSpec[] = []): IInputDefaultProvider => ({
  widgetId: id,
  getDefaultInputActions: () => actions,
});

describe('WidgetRegistry.getInputDefaultProviders', () => {
  it('returns empty array when no widgets implement IInputDefaultProvider', () => {
    const registry = new WidgetRegistry();
    registry.register(makeBasicWidget('basic-1'));
    expect(registry.getInputDefaultProviders()).toHaveLength(0);
  });

  it('returns only widgets implementing IInputDefaultProvider', () => {
    const registry = new WidgetRegistry();
    registry.register(makeBasicWidget('basic-1'));
    registry.register(makeProviderWidget('provider-1'));
    registry.register(makeBasicWidget('basic-2'));
    const providers = registry.getInputDefaultProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0]!.widgetId).toBe('provider-1');
  });

  it('returns all IInputDefaultProvider widgets when multiple registered', () => {
    const registry = new WidgetRegistry();
    registry.register(makeProviderWidget('canvas-a'));
    registry.register(makeProviderWidget('canvas-b'));
    const providers = registry.getInputDefaultProviders();
    expect(providers).toHaveLength(2);
    const ids = providers.map((p) => p.widgetId);
    expect(ids).toContain('canvas-a');
    expect(ids).toContain('canvas-b');
  });
});

describe('isInputDefaultProvider', () => {
  it('returns true for a widget with getDefaultInputActions', () => {
    expect(isInputDefaultProvider(makeProviderWidget('p'))).toBe(true);
  });

  it('returns false for a widget without getDefaultInputActions', () => {
    expect(isInputDefaultProvider(makeBasicWidget('w'))).toBe(false);
  });

  it('returns false for a widget with a non-function getDefaultInputActions property', () => {
    const bad: IWidget & { getDefaultInputActions: string } = {
      widgetId: 'bad',
      getDefaultInputActions: 'not-a-function',
    };
    expect(isInputDefaultProvider(bad)).toBe(false);
  });
});
