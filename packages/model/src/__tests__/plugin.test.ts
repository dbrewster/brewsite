import { describe, it, expect } from 'vitest';
import { modelPlugin } from '../plugin';

describe('modelPlugin', () => {
  it('modelPlugin() has fetchManifest that returns null when no URL provided', async () => {
    const plugin = modelPlugin();
    const manifest = await plugin.fetchManifest();
    expect(manifest).toBeNull();
  });

  it('modelPlugin() createWidgets() returns empty array (factories registered separately)', () => {
    const plugin = modelPlugin();
    expect(plugin.createWidgets()).toHaveLength(0);
  });

  it('modelPlugin() registerHandlers() is idempotent', () => {
    const plugin = modelPlugin();
    expect(() => {
      plugin.registerHandlers();
      plugin.registerHandlers();
    }).not.toThrow();
  });

  it('modelPlugin() getManifest() returns null when no manifest is provided', () => {
    const plugin = modelPlugin();
    expect(plugin.getManifest()).toBeNull();
  });

  it('modelPlugin() getManifest() returns manifest when provided directly', () => {
    const manifest = {
      version: 2,
      models: [],
      animations: [],
    };
    const plugin = modelPlugin({ manifest });
    expect(plugin.getManifest()).toBe(manifest);
  });
});
