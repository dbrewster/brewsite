import { describe, it, expect } from 'vitest';
import { createDefaultWidgetRegistry } from '../defaultWidgets';

describe('createDefaultWidgetRegistry', () => {
  it('registers default core widgets when manifest is null', () => {
    const registry = createDefaultWidgetRegistry(null);
    expect(registry.getAll().length).toBeGreaterThan(0);
    expect(registry.get('__scene_meta__')).toBeDefined();
    expect(registry.get('lighting')).toBeDefined();
    expect(registry.get('background')).toBeDefined();
    expect(registry.get('camera')).toBeDefined();
    expect(registry.get('floor')).toBeDefined();
    expect(registry.get('environment')).toBeDefined();
  });

  it('registers the same core widgets regardless of manifest', () => {
    const registryWithNull = createDefaultWidgetRegistry(null);
    const registryWithManifest = createDefaultWidgetRegistry({ version: 2, models: [], animations: [] });
    expect(registryWithNull.getAll().length).toBe(registryWithManifest.getAll().length);
  });
});
