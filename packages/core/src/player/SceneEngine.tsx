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
import { WidgetRegistry as WidgetRegistryClass } from '../widget/WidgetRegistry';
import type { WidgetPlugin } from '../widget/WidgetPlugin';
import { useSceneEngine } from './useSceneEngine';
import { EngineContext } from './EngineContext';
import { EngineStateContext } from './EngineStateContext';
import { VariableStoreContext } from '../widget/VariableStoreContext';
import { SceneRegistrationContext } from '../compiler/SceneRegistrationContext';
import type { SceneRegistrationValue } from '../compiler/SceneRegistrationContext';
import { ThemeContext } from '../theme/ThemeContext';
import type { SceneTheme } from '../theme/types';
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

  /** Scene theme token set for cross-package visual styling. */
  sceneTheme?: SceneTheme;

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
  const [manifest] = useState(null);

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
    timingProfile: props.timingProfile,
    maxAnimBoostPerFrame: props.maxAnimBoostPerFrame,
    invalidateCacheToken: props.invalidateCacheToken,
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
    <EngineStateContext.Provider value={engineState}>
      <EngineContext.Provider value={engine}>
        {props.children}
      </EngineContext.Provider>
    </EngineStateContext.Provider>
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
    <ThemeContext.Provider value={props.sceneTheme ?? null}>
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
