// Widget plugin contract — composable unit of widget and handler registration.

import type { ReactNode } from 'react';
import type { IWidget, AssetManifest } from './types';
import type { WidgetRegistry } from './WidgetRegistry';
import type { ActionInputHandler } from '../input/ActionInputController';
import type { SceneTrack } from '../compiler/sceneTrackTypes';
import type * as THREE from 'three';

/**
 * Contract for a composable widget package.
 *
 * Passed to SceneEngine via the `plugins` prop. Each plugin is responsible
 * for registering its own widgets and DSL NodeHandlers. Plugins are initialized
 * in the order they appear in the plugins array.
 *
 * Design rules:
 * - createWidgets() is called once when SceneEngine mounts.
 * - registerHandlers() must be idempotent (safe to call multiple times).
 * - Plugins must not import from each other — use shared core interfaces only.
 *
 * @example
 * // In SceneEngine:
 * plugins={[corePlugin(), modelPlugin({ manifestUrl: '/assets/manifest.json' })]}
 */
export interface WidgetPlugin {
  /**
   * Returns widget instances to register into the runtime WidgetRegistry.
   * Called once before first compilation. Widgets are registered in the order
   * they are returned — duplicate widgetIds will warn (or throw in strict mode).
   */
  createWidgets(): IWidget[];

  /**
   * Registers DSL NodeHandlers for this plugin's components into the global
   * compiler registry. Must be idempotent — safe to call multiple times
   * (subsequent calls after the first are no-ops).
   * Called once before first scene compilation.
   */
  registerHandlers(): void;

  /**
   * Optional: fetches any external assets this plugin needs (e.g. a model
   * manifest JSON). Called once by SceneEngine on mount, before the first
   * compilation. The resolved manifest is passed to configureRegistry().
   *
   * Implement this when your plugin needs remote data before widgets can be
   * registered. If the fetch fails, throw — SceneEngine will surface the error
   * via onError. Return null if no manifest is needed.
   */
  fetchManifest?(): Promise<AssetManifest | null>;

  /**
   * Optional: performs plugin-specific WidgetRegistry configuration after all
   * widgets from this plugin have been registered. Use to install type factories,
   * set up inter-widget cross-references, or apply manifest-derived configuration.
   *
   * Called by SceneEngine immediately after this plugin's createWidgets() results
   * are registered. `manifest` is null when no manifest has been fetched yet;
   * called again once fetchManifest() resolves with the actual data.
   */
  configureRegistry?(registry: WidgetRegistry, manifest: AssetManifest | null): void;

  /**
   * Optional: reconcile a compiled SceneTrack back into the live WidgetRegistry.
   * Use this for plugins that author state into the track before all widget instances
   * are materialized, so runtime renderables can be created from the compiled output.
   */
  reconcileCompiledTrack?(registry: WidgetRegistry, track: SceneTrack): void;

  /**
   * Optional: wraps SceneEngine's rendered subtree with this plugin's React
   * context providers. Called by SceneEngine during render. The returned JSX
   * replaces `children` as the inner content.
   *
   * Use to install React context that plugin components (e.g. LabelItem) consume.
   * modelPlugin uses this to provide LabelPositionerContext without requiring
   * call sites to add a separate wrapper component.
   *
   * @example
   * wrapProvider: (children) => (
   *   <LabelPositionerContext.Provider value={labelPositioner}>
   *     {children}
   *   </LabelPositionerContext.Provider>
   * )
   */
  wrapProvider?(children: ReactNode): ReactNode;

  /**
   * Optional: returns extensions to the ActionInputHandler passed to ActionInputController.
   * Called by useSceneEngine after all plugins are initialized and the WidgetRegistry is
   * constructed. The returned partial is merged into the handler passed to useEngineInput.
   *
   * Use this to provide `onUnknownAction` handling for action types not built into core.
   * @brewsite/diagram uses this to handle 'diagram-canvas.*' action types.
   */
  getActionInputExtension?(
    registry: WidgetRegistry,
  ): Partial<Pick<ActionInputHandler, 'onUnknownAction'>>;

  /**
   * Optional: called when a WebGLRenderer instance is created.
   * Use to set up GPU resources that depend on a specific renderer instance.
   */
  onRendererCreated?(renderer: THREE.WebGLRenderer): void;

  /**
   * Optional: called just before a WebGLRenderer is disposed.
   * Use to release GPU resources tied to this renderer.
   */
  onRendererDisposing?(renderer: THREE.WebGLRenderer): void;
}
