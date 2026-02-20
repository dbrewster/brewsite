import { describe, it, expect } from 'vitest';
import { createDefaultWidgetRegistry } from '../defaultWidgets';
import type { AssetManifest } from '../../elements/model/metadata';

const makeManifest = (): AssetManifest => ({
  version: 2,
  models: [
    {
      id: 'primary',
      glb: '/model.glb',
      bones: [],
      meshes: [],
      anchorTargets: {},
    },
  ],
  containedModels: [],
  animations: [],
});

describe('createDefaultWidgetRegistry', () => {
  it('registers default widgets when manifest is null', () => {
    const registry = createDefaultWidgetRegistry(null);
    expect(registry.getAll().length).toBeGreaterThan(0);
    expect(registry.get('__scene_meta__')).toBeDefined();
  });

  it('registers model widgets from manifest', () => {
    const registry = createDefaultWidgetRegistry(makeManifest());
    expect(registry.get('primary')).toBeDefined();
  });
});
