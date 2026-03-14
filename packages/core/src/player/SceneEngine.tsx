// SceneEngine.tsx — Pure React context provider. No DOM output. Owns plugin wiring,
// scene compilation, RAF loop, and context provision. Replaces EngineProvider.

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { ActionInputExtensionContext } from './ActionInputExtensionContext';
import type { ActionInputExtension } from './ActionInputExtensionContext';
import { WidgetRegistry as WidgetRegistryClass } from '../widget/WidgetRegistry';
import type { WidgetPlugin } from '../widget/WidgetPlugin';
import { useSceneEngine } from './useSceneEngine';
import { EngineContext } from './EngineContext';
import { EngineStateContext } from './EngineStateContext';
import { VariableStoreContext } from '../widget/VariableStoreContext';
import { SceneRegistrationContext } from '../compiler/SceneRegistrationContext';
import type { SceneRegistrationValue } from '../compiler/SceneRegistrationContext';
import { ThemeContext } from '../theme/ThemeContext';
import type { SceneTheme, ThemeFamily, ThemePolarity, ActiveTheme } from '../theme/types';
import { resolveSceneTheme } from '../theme/sceneThemeRegistry';
import { serializeJsx } from './serializeJsx';
import {
  setSceneRuntimeState,
  setEngineSnapshot,
  unregisterSceneRuntime,
  registerCanvasBinding,
  unregisterCanvasBinding,
} from './ScenePlayerRegistry';
import { PluginInheritanceContext } from './PluginInheritanceContext';
import type {
  CameraInteractionDefaults,
  EngineTimingProfile,
  InternalSceneSpec,
  ScrollSource,
  ViewportRelativeScrollSource,
} from './engineTypes';
import { useViewportRelativeScroll } from './useViewportRelativeScroll';
import type { CompileWarning } from '../compiler/sceneTrackTypes';
import type { AssetManifest } from '../widget/types';

export interface SceneEngineProps {
  /**
   * Registers this engine in the global registry for useSceneEngineState(id) /
   * useSceneRuntime(id). Optional; omit for anonymous engines.
   */
  id?: string;

  /**
   * Widget plugins. Required unless a parent SceneEngine (zero-scene mode)
   * already provides plugins via PluginInheritanceContext.
   * When omitted, inherits from the nearest ancestor SceneEngine context.
   * When both own and inherited are present, own props wins.
   */
  plugins?: WidgetPlugin[];

  timingProfile?: EngineTimingProfile;

  /** Widget id of the primary scene camera. */
  primaryCameraId?: string;

  /** Widget id of the canvas that receives action-based input (orbit, dolly, focus). */
  primaryCanvasActionTargetId?: string;

  cameraInteractionDefaults?: CameraInteractionDefaults;

  /**
   * Increment to force SceneTrack recompilation when DSL hasn't changed
   * structurally but content has (e.g., dynamic asset URLs).
   */
  invalidateCacheToken?: number | string;

  /** Cap on animation-seconds that may advance in a single frame. Default: 2. */
  maxAnimBoostPerFrame?: number;

  /**
   * Active theme selection for this engine instance.
   * Replaces the older `themeFamily` / `themePolarity` / `sceneTheme` props.
   */
  theme?: ActiveTheme;

  /**
   * Scene theme token set for cross-package visual styling.
   * @deprecated Use `theme` prop instead.
   */
  sceneTheme?: SceneTheme;

  /**
   * Theme family key.
   * @deprecated Use `theme` prop instead: `theme={{ family: 'darkGlass', polarity: 'dark' }}`.
   */
  themeFamily?: ThemeFamily;

  /**
   * Theme polarity ('dark' | 'light'). Defaults to 'dark' when themeFamily is set.
   * @deprecated Use `theme` prop instead.
   */
  themePolarity?: ThemePolarity;

  /**
   * Optional scroll source for this engine.
   * When set to a ViewportRelativeScrollSource, the engine tracks scroll progress
   * through the referenced container element and manages WebGL context lifecycle
   * via IntersectionObserver. All other source variants are for future use.
   */
  scrollSource?: ScrollSource;

  onReady?: () => void;
  onError?: (error: Error) => void;
  onWidgetError?: (widgetId: string, error: Error) => void;
  onCompileWarning?: (warnings: CompileWarning[]) => void;

  /**
   * All children — <Scene> declarations, input components, layout, overlay hosts.
   * Zero <Scene> children is valid (config-only / plugin-hoisting mode).
   */
  children: ReactNode;
}

/**
 * SceneEngine — pure context provider with zero DOM output. Owns plugin wiring,
 * scene compilation, RAF loop, and context provision. Replaces EngineProvider.
 */
export const SceneEngine = (props: SceneEngineProps): ReactElement => {
  // ─── Theme resolution ──────────────────────────────────────────────────────
  // Compute resolved ActiveTheme from the new `theme` prop or deprecated legacy props.
  const resolvedActiveTheme = useMemo((): ActiveTheme => {
    if (props.theme) return props.theme;
    if (props.themeFamily) {
      return { family: props.themeFamily, polarity: props.themePolarity ?? 'dark' };
    }
    return { family: 'default', polarity: 'dark' };
  }, [props.theme, props.themeFamily, props.themePolarity]);

  // Resolve the SceneTheme for ThemeContext (CSS variable injection via EngineOverlayHost).
  const resolvedSceneTheme = useMemo((): SceneTheme => {
    if (props.sceneTheme) return props.sceneTheme;
    return resolveSceneTheme(resolvedActiveTheme.family, resolvedActiveTheme.polarity);
  }, [props.sceneTheme, resolvedActiveTheme]);


  // ─── Plugin resolution ──────────────────────────────────────────────────────
  const inheritedPlugins = useContext(PluginInheritanceContext);

  const resolvedPlugins = useMemo((): WidgetPlugin[] => {
    if (props.plugins) return props.plugins;
    if (inheritedPlugins) return inheritedPlugins;
    console.error(
      '[BrewSite] <SceneEngine> requires a `plugins` prop or a parent <SceneEngine> ' +
      'providing plugins via zero-scene mode. Pass plugins={[corePlugin(), ...]}.',
    );
    return [];
  }, [props.plugins, inheritedPlugins]);

  // ─── Scene registration ─────────────────────────────────────────────────────
  const registrationsRef = useRef(new Map<string, ReactElement>());
  const lastContentKeyRef = useRef('');
  const [scenes, setScenes] = useState<InternalSceneSpec[]>([]);
  const [manifest, setManifest] = useState<AssetManifest | null>(null);

  // Fetch manifests from any plugin that needs remote data (e.g. model manifest JSON).
  // Runs once per plugin set. When any plugin resolves a non-null manifest, the
  // widgetRegistry useMemo re-runs with the actual data and configureRegistry()
  // is called again — this time with the manifest, completing type factory registration.
  useEffect(() => {
    const pluginsWithFetch = resolvedPlugins.filter((p) => p.fetchManifest != null);
    if (pluginsWithFetch.length === 0) return;
    let cancelled = false;
    Promise.all(pluginsWithFetch.map((p) => p.fetchManifest!()))
      .then((manifests) => {
        if (cancelled) return;
        const resolved = manifests.find((m) => m != null) ?? null;
        if (resolved) setManifest(resolved);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('[SceneEngine] Failed to fetch plugin manifest:', err);
        props.onError?.(err instanceof Error ? err : new Error(String(err)));
      });
    return () => { cancelled = true; };
  // resolvedPlugins is stable (useMemo) — only re-fetch if the plugin set changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedPlugins]);

  const register = useCallback((id: string, element: ReactElement) => {
    registrationsRef.current.set(id, element);
  }, []);

  const unregister = useCallback((id: string) => {
    registrationsRef.current.delete(id);
  }, []);

  const registrationContextValue = useMemo(
    (): SceneRegistrationValue => ({ register, unregister }),
    [register, unregister],
  );

  // Sync scenes on every render (same pattern as EngineProvider)
  useEffect(() => {
    const specs = Array.from(registrationsRef.current.entries()).map(
      ([id, element]): InternalSceneSpec => ({
        sceneKey: id,
        contentKey: serializeJsx(element),
        element,
      }),
    );
    const contentKey = specs.map((s) => s.contentKey).join('|||');
    if (contentKey === lastContentKeyRef.current) return;
    lastContentKeyRef.current = contentKey;
    setScenes(specs);
  });

  // ─── Widget registry ────────────────────────────────────────────────────────
  // IMPORTANT: configureRegistry() calls registerNode() which mutates a global
  // handler map. React 18 StrictMode double-calls useMemo initializers in dev —
  // the first result is kept, but the second call's registerNode overwrites global
  // handlers with closures that capture the discarded second registry instance.
  // To prevent this mismatch, we store the registry in a ref and re-run
  // configureRegistry after useMemo to ensure the global handlers always capture
  // the same registry instance that useMemo returned.
  const widgetRegistry = useMemo(() => {
    for (const plugin of resolvedPlugins) {
      plugin.registerHandlers();
    }
    const reg = new WidgetRegistryClass({ strict: true });
    for (const plugin of resolvedPlugins) {
      for (const widget of plugin.createWidgets()) {
        reg.register(widget);
      }
      plugin.configureRegistry?.(reg, manifest);
    }
    return reg;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedPlugins, manifest]);

  // Re-run configureRegistry outside useMemo to ensure the global node handlers
  // capture the KEPT registry instance (not the discarded StrictMode duplicate).
  // configureRegistry is idempotent for widget registration (guards are already
  // overwritten), but the registerNode() calls inside it re-bind the closures
  // to the correct registry reference.
  useMemo(() => {
    for (const plugin of resolvedPlugins) {
      plugin.configureRegistry?.(widgetRegistry, manifest);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetRegistry]);

  // ─── Viewport-relative scroll source detection ──────────────────────────────
  // Detect viewport-relative scroll source.
  const vpScrollSource: ViewportRelativeScrollSource | null =
    props.scrollSource !== undefined &&
    typeof props.scrollSource === 'object' &&
    props.scrollSource.kind === 'viewport-relative'
      ? props.scrollSource
      : null;

  // ─── Engine hook ────────────────────────────────────────────────────────────
  const engine = useSceneEngine({
    scenes,
    widgetRegistry,
    plugins: resolvedPlugins,
    manifest,
    sceneTheme: resolvedSceneTheme,
    activeTheme: resolvedActiveTheme,
    timingProfile: props.timingProfile,
    maxAnimBoostPerFrame: props.maxAnimBoostPerFrame,
    invalidateCacheToken: props.invalidateCacheToken,
    primaryCameraId: props.primaryCameraId,
    primaryCanvasActionTargetId: props.primaryCanvasActionTargetId,
    onReady: props.onReady,
    onError: props.onError,
    onWidgetError: props.onWidgetError,
    onCompileWarning: props.onCompileWarning,
  });

  // ─── Viewport-relative scroll + context lifecycle ───────────────────────────
  // useViewportRelativeScroll is always called unconditionally (React rules of hooks);
  // it is a no-op when vpScrollSource is null.
  useViewportRelativeScroll({
    source: vpScrollSource,
    onProgress: vpScrollSource ? engine.setProgress : null,
  });

  // ─── Global registry push (runtime state) ──────────────────────────────────
  const { id } = props;
  const assetsReady = engine.debug?.assetsReady ?? false;
  const viewport = engine.debug?.viewport ?? { width: 1, height: 1 };

  useEffect(() => {
    if (!id) return undefined;
    setSceneRuntimeState(id, {
      assetsReady,
      viewport: {
        width: viewport.width,
        height: viewport.height,
        aspectRatio: viewport.width / Math.max(1, viewport.height),
      },
      variables: engine.variableStore,
      numScenes: scenes.length,
    });
    return () => unregisterSceneRuntime(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, assetsReady, viewport.width, viewport.height, engine.variableStore, scenes.length]);

  // ─── Global registry push (frame snapshot) ──────────────────────────────────
  useEffect(() => {
    if (!id) return;
    setEngineSnapshot(id, {
      sceneId: engine.frameState.sceneId,
      sceneIndex: engine.frameState.sceneIndex,
      sceneProgress: engine.frameState.sceneProgress,
      progress: engine.progress,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, engine.frameState, engine.progress]);

  // ─── Canvas binding registry ────────────────────────────────────────────────
  // Allows SceneCanvas with engineId prop to register from outside the React subtree.
  useEffect(() => {
    if (!id) return;
    registerCanvasBinding(id, {
      setCanvasRef: engine.setCanvasRef,
      setViewportSize: engine.setViewportSize,
    });
    return () => unregisterCanvasBinding(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, engine.setCanvasRef, engine.setViewportSize]);

  // ─── Plugin action input extensions ─────────────────────────────────────────
  // Collect onUnknownAction handlers from all plugins and merge into a single function.
  // Scoped to this engine's React subtree so multi-engine pages get independent extensions.
  const mergedActionInputExtension = useMemo((): ActionInputExtension | null => {
    const handlers = resolvedPlugins
      .map((p) => p.getActionInputExtension?.(widgetRegistry))
      .filter(Boolean)
      .map((ext) => ext!.onUnknownAction)
      .filter((fn): fn is ActionInputExtension => fn != null);
    if (handlers.length === 0) return null;
    return (type, canvasId, event, extra) => {
      for (const handler of handlers) handler(type, canvasId, event, extra);
    };
  }, [resolvedPlugins, widgetRegistry]);

  // ─── Engine state memo ──────────────────────────────────────────────────────
  const engineState = useMemo(() => ({
    tickIndex: engine.frameState.tickIndex,
    progress: engine.progress,
    sceneId: engine.frameState.sceneId,
    sceneIndex: engine.frameState.sceneIndex,
    sceneProgress: engine.frameState.sceneProgress,
  }), [engine.progress, engine.frameState]);

  // ─── Plugin wrapProvider chain ──────────────────────────────────────────────
  // Applied in reverse plugin order so the first plugin is outermost.
  let innerContent: ReactNode = (
    <ActionInputExtensionContext.Provider value={mergedActionInputExtension}>
      <EngineStateContext.Provider value={engineState}>
        <EngineContext.Provider value={engine}>
          {props.children}
        </EngineContext.Provider>
      </EngineStateContext.Provider>
    </ActionInputExtensionContext.Provider>
  );
  for (let i = resolvedPlugins.length - 1; i >= 0; i--) {
    const plugin = resolvedPlugins[i]!;
    if (plugin.wrapProvider) {
      innerContent = plugin.wrapProvider(innerContent);
    }
  }

  // SSR policy: identical to EngineProvider — contexts provide defaults on server;
  // Three.js and RAF loop are guarded inside useSceneEngine. SceneCanvas renders
  // null on server. Children always render for SSR layout correctness.

  return (
    <ThemeContext.Provider value={resolvedSceneTheme}>
      <SceneRegistrationContext.Provider value={registrationContextValue}>
        <VariableStoreContext.Provider value={engine.variableStore}>
          <PluginInheritanceContext.Provider value={resolvedPlugins}>
            {innerContent}
          </PluginInheritanceContext.Provider>
        </VariableStoreContext.Provider>
      </SceneRegistrationContext.Provider>
    </ThemeContext.Provider>
  );
};
