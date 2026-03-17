// Textures plugin — registers material manifest and loader lifecycle hooks.

import type { WidgetPlugin, WidgetRegistry, AssetManifest, MaterialManifest, MaterialPreset } from '@brewsite/core';
import type * as THREE from 'three';
import { BUILTIN_MANIFEST } from './manifest';

/**
 * Configuration options for the textures plugin.
 */
export interface TexturesPluginOptions {
  /** Where KTX2 assets are served from. Default: '/assets/materials'. */
  basePath?: string;
  /** Path to the Basis transcoder files. Default: basePath + '/basis/'. */
  transcoderPath?: string;
  /** Additional presets to register (merged into built-in manifest). */
  extraPresets?: Record<string, MaterialPreset>;
}

/**
 * Creates a WidgetPlugin that registers the built-in material manifest
 * and manages the MaterialLoader lifecycle on the WidgetRegistry.
 *
 * Usage:
 * ```ts
 * plugins={[texturesPlugin({ basePath: '/assets/materials' })]}
 * ```
 */
export function texturesPlugin(options: TexturesPluginOptions = {}): WidgetPlugin {
  const basePath = options.basePath ?? '/assets/materials';
  const transcoderPath = options.transcoderPath ?? `${basePath}/basis/`;

  // Captured during configureRegistry(), used by lifecycle hooks.
  let registryRef: WidgetRegistry | null = null;

  const manifest: MaterialManifest = {
    version: BUILTIN_MANIFEST.version,
    basePath,
    presets: {
      ...BUILTIN_MANIFEST.presets,
      ...options.extraPresets,
    },
  };

  return {
    createWidgets: () => [],
    registerHandlers: () => {},

    configureRegistry(registry: WidgetRegistry, _manifest: AssetManifest | null): void {
      registryRef = registry;
      registry.setMaterialManifest(manifest);
    },

    onRendererCreated(renderer: THREE.WebGLRenderer): void {
      if (!registryRef) return;
      const loader = registryRef.getMaterialLoader();
      loader.initialize(renderer, transcoderPath);
    },

    onRendererDisposing(renderer: THREE.WebGLRenderer): void {
      if (!registryRef) return;
      const loader = registryRef.getMaterialLoader();
      loader.disposeForRenderer(renderer);
    },
  };
}
