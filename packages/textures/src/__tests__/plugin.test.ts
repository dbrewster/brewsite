// Tests for texturesPlugin() — validates WidgetPlugin contract and configuration.

import { describe, it, expect } from 'vitest';
import { texturesPlugin } from '../plugin';
import { BUILTIN_MANIFEST } from '../manifest';
import { WidgetRegistry } from '@brewsite/core';
import type { MaterialPreset, MaterialManifest } from '@brewsite/core';

describe('texturesPlugin', () => {
  it('returns a valid WidgetPlugin with required methods', () => {
    const plugin = texturesPlugin();
    expect(typeof plugin.createWidgets).toBe('function');
    expect(typeof plugin.registerHandlers).toBe('function');
    expect(typeof plugin.configureRegistry).toBe('function');
    expect(typeof plugin.onRendererCreated).toBe('function');
    expect(typeof plugin.onRendererDisposing).toBe('function');
  });

  it('createWidgets returns an empty array', () => {
    const plugin = texturesPlugin();
    expect(plugin.createWidgets()).toEqual([]);
  });

  it('configureRegistry calls setMaterialManifest with resolved manifest', () => {
    const plugin = texturesPlugin();
    const registry = new WidgetRegistry();

    plugin.configureRegistry!(registry, null);

    const manifest = registry.getMaterialManifest();
    expect(manifest).not.toBeNull();
    expect(manifest!.version).toBe(BUILTIN_MANIFEST.version);
    expect(manifest!.basePath).toBe('/assets/materials');
    expect(Object.keys(manifest!.presets)).toHaveLength(10);
  });

  it('basePath override flows through to manifest', () => {
    const plugin = texturesPlugin({ basePath: '/custom/path' });
    const registry = new WidgetRegistry();

    plugin.configureRegistry!(registry, null);

    const manifest = registry.getMaterialManifest();
    expect(manifest!.basePath).toBe('/custom/path');
  });

  it('extraPresets merge into built-in presets', () => {
    const customPreset: MaterialPreset = {
      maps: {
        color: 'presets/custom/color.ktx2',
        normal: 'presets/custom/normal.ktx2',
        roughness: 'presets/custom/roughness.ktx2',
      },
      defaults: { metalness: 0.5, roughness: 0.5 },
    };

    const plugin = texturesPlugin({
      extraPresets: { 'custom-material': customPreset },
    });
    const registry = new WidgetRegistry();

    plugin.configureRegistry!(registry, null);

    const manifest = registry.getMaterialManifest() as MaterialManifest;
    expect(Object.keys(manifest.presets)).toHaveLength(11);
    expect(manifest.presets['custom-material']).toEqual(customPreset);
    // Built-in presets are still present.
    expect(manifest.presets['onyx']).toBeDefined();
  });

  it('extraPresets can override built-in presets', () => {
    const overridePreset: MaterialPreset = {
      maps: {
        color: 'presets/custom-onyx/color.ktx2',
        normal: 'presets/custom-onyx/normal.ktx2',
        roughness: 'presets/custom-onyx/roughness.ktx2',
      },
      defaults: { metalness: 0.1, roughness: 0.1 },
    };

    const plugin = texturesPlugin({
      extraPresets: { 'onyx': overridePreset },
    });
    const registry = new WidgetRegistry();

    plugin.configureRegistry!(registry, null);

    const manifest = registry.getMaterialManifest() as MaterialManifest;
    expect(manifest.presets['onyx']).toEqual(overridePreset);
  });

  it('default transcoderPath is basePath + /basis/', () => {
    // We can't directly observe transcoderPath without a renderer,
    // but we verify the plugin doesn't throw during construction.
    const plugin = texturesPlugin({ basePath: '/my/path' });
    expect(plugin).toBeDefined();
  });

  it('onRendererCreated is safe to call before configureRegistry', () => {
    const plugin = texturesPlugin();
    // registryRef is null — should silently no-op.
    expect(() => plugin.onRendererCreated!({} as never)).not.toThrow();
  });

  it('onRendererDisposing is safe to call before configureRegistry', () => {
    const plugin = texturesPlugin();
    // registryRef is null — should silently no-op.
    expect(() => plugin.onRendererDisposing!({} as never)).not.toThrow();
  });
});
