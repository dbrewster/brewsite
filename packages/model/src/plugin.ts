// modelPlugin factory — composable WidgetPlugin for @brewsite/model.

import { createElement, useContext, useEffect } from 'react';
import type { ReactNode, ReactElement } from 'react';
import type { WebGLRenderer } from 'three';
import type { WidgetPlugin, WidgetRegistry } from '@brewsite/core';
import { ViewportScaleContext } from '@brewsite/core';
import type { AssetManifest } from './elements/model/metadata';
import type { SceneModel } from './elements/model/types';
import { clipMetaFromManifest, assertManifestValid } from './elements/model/metadata';
import { ModelRouter } from './elements/model/dsl';
import { ModelWidget } from './elements/model/ModelWidget';
import { ModelRenderer } from './elements/model/ModelRenderer';
import { registerModelHandlers } from './handlers';
import { LabelPositioner } from './player/LabelPositioner';
import { LabelPositionerContext } from './player/LabelPositionerContext';

export interface ModelPluginOptions {
  /**
   * URL to fetch the asset manifest JSON from (e.g. '/assets/manifest.json').
   * Mutually exclusive with `manifest`. When provided, the plugin fetches the
   * manifest asynchronously during EngineProvider mount.
   */
  manifestUrl?: string;

  /**
   * Pre-loaded asset manifest. Use when you have already fetched and validated
   * the manifest. Mutually exclusive with `manifestUrl`.
   */
  manifest?: AssetManifest | null;

  /**
   * Per-model default state overrides. Key = widgetId used by <Model id="...">.
   * Applied to each ModelWidget created by the factory.
   */
  defaultModelStates?: Partial<Record<string, Partial<SceneModel>>>;
}

/**
 * WidgetPlugin for @brewsite/model.
 *
 * Provides: ModelWidget (via typeFactory — widgets created lazily on first DSL
 * encounter), Label and Labels DSL guard handlers.
 *
 * Must be combined with corePlugin() from @brewsite/core:
 * @example
 * plugins={[corePlugin(), modelPlugin({ manifestUrl: '/assets/manifest.json' })]}
 *
 * The manifest (models + animations) is owned by this plugin. It is fetched
 * asynchronously when manifestUrl is provided, or used directly when manifest
 * is provided. Asset loading begins when each ModelWidget's load() is called
 * by RuntimeDriverImpl after initialize().
 */
export function modelPlugin(options: ModelPluginOptions = {}): WidgetPlugin & {
  /**
   * Returns the resolved manifest after it has been fetched.
   * null before fetch completes or when no manifest was provided.
   */
  getManifest(): AssetManifest | null;
  /**
   * Fetches and validates the manifest from manifestUrl.
   * Called internally by EngineProvider on mount when manifestUrl is set.
   * No-op when manifest is provided directly.
   */
  fetchManifest(): Promise<AssetManifest | null>;
} {
  let resolvedManifest: AssetManifest | null = options.manifest ?? null;
  const labelPositioner = new LabelPositioner();

  /**
   * Tracks all ModelWidget instances created by the type factory.
   * Used by LabelPositionerSyncer to read nvsBounds from the active widget.
   */
  const modelWidgets: ModelWidget[] = [];

  /**
   * Reads the AR-container dimensions from EngineARContainerContext and forwards
   * them to labelPositioner.setContainerSize() on every resize. Defined once per
   * modelPlugin() call so the component type is stable across renders.
   */
  const LabelPositionerSyncer = (): ReactElement | null => {
    const { containerWidth, containerHeight } = useContext(ViewportScaleContext);
    useEffect(() => {
      const widget = modelWidgets[0];
      const nvsBounds = widget?.nvsBounds ?? undefined;
      labelPositioner.setContainerSize(containerWidth, containerHeight, nvsBounds);
    }, [containerWidth, containerHeight, modelWidgets[0]?.nvsBounds]);
    return null;
  };

  const fetchManifest = async (): Promise<AssetManifest | null> => {
    if (resolvedManifest !== null) return resolvedManifest;
    if (!options.manifestUrl) return null;
    const response = await fetch(options.manifestUrl);
    if (!response.ok) {
      throw new Error(`[modelPlugin] Failed to fetch manifest: ${response.status} ${options.manifestUrl}`);
    }
    const raw = await response.json();
    resolvedManifest = assertManifestValid(raw);
    return resolvedManifest;
  };

  return {
    getManifest: () => resolvedManifest,
    fetchManifest,

    createWidgets: () => {
      // ModelWidget instances are created lazily via typeFactory on first DSL encounter.
      // The plugin registers the factory on the WidgetRegistry in configureRegistry().
      // createWidgets() returns [] — the factory is set up in configureRegistry().
      return [];
    },

    registerHandlers: () => {
      registerModelHandlers();
    },

    configureRegistry(reg: WidgetRegistry, manifest: AssetManifest | null): void {
      if (!manifest) return;
      const clipMeta = clipMetaFromManifest(manifest);
      reg.registerTypeFactory(ModelRouter, (props) => {
        const type = typeof props['type'] === 'string' ? props['type'] : null;
        const id = typeof props['id'] === 'string' ? props['id'] : null;
        if (!type || !id) {
          throw new Error('[modelPlugin] Model factory requires string type and id props.');
        }
        const modelMeta = manifest.models.find((m) => m.type === type);
        if (!modelMeta) {
          const available = manifest.models.map((m) => m.type).join(', ') || '(none)';
          throw new Error(`[modelPlugin] Unknown model type "${type}". Available: ${available}`);
        }
        const widget = new ModelWidget(
          { modelMeta, clipMeta, widgetId: id },
          options.defaultModelStates?.[id],
        );
        modelWidgets.push(widget);
        return widget;
      });
    },

    onRendererDisposing: (_renderer: WebGLRenderer) => {
      ModelRenderer.disposeKtx2Loader(_renderer);
    },

    wrapProvider: (children: ReactNode): ReactNode =>
      createElement(
        LabelPositionerContext.Provider,
        { value: labelPositioner },
        createElement(LabelPositionerSyncer, null),
        children,
      ),
  };
}
