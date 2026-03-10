// Tests for diagramPlugin factory — §9.3d

import { describe, it, expect } from 'vitest';
import { diagramPlugin } from '../player/diagramPlugin';
import { DiagramWidget } from '../elements/diagram/widget';
import { WidgetRegistry } from '@brewsite/core';

describe('diagramPlugin', () => {
  it('registers one DiagramWidget per declared diagram ID', () => {
    const registry = new WidgetRegistry();
    const plugin = diagramPlugin({ diagrams: ['id-a', 'id-b'] });
    for (const widget of plugin.createWidgets()) {
      registry.register(widget);
    }

    const widgetA = registry.get('id-a');
    const widgetB = registry.get('id-b');

    expect(widgetA).toBeInstanceOf(DiagramWidget);
    expect(widgetB).toBeInstanceOf(DiagramWidget);
    expect(widgetA?.widgetId).toBe('id-a');
    expect(widgetB?.widgetId).toBe('id-b');
  });

  it('registers exactly the declared number of widgets', () => {
    const registry = new WidgetRegistry();
    for (const widget of diagramPlugin({ diagrams: ['x', 'y', 'z'] }).createWidgets()) {
      registry.register(widget);
    }
    expect([...registry.getAllWidgets()]).toHaveLength(3);
  });
});
