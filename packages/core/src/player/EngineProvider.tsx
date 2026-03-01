// Engine creation + context provision. No DOM output — renders only contexts and children.
// Composable alternative to ScenePlayer for advanced layout patterns.

import {
  useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type ReactElement,
} from 'react';
import type { AssetManifest } from '../elements/model/metadata';
import { clipMetaFromManifest, assertManifestValid } from '../elements/model/metadata';
import type { WidgetRegistry } from '../widget/WidgetRegistry';
import { WidgetRegistry as WidgetRegistryClass } from '../widget/WidgetRegistry';
import { createDefaultWidgetRegistry } from './defaultWidgets';
import type { WidgetPlugin } from '../widget/WidgetPlugin';
import { useSceneEngine } from './useSceneEngine';
import { EngineContext } from './EngineContext';
import { EngineStateContext } from './EngineStateContext';
import { VariableStoreContext } from '../widget/VariableStoreContext';
import { LabelPositioner } from './LabelPositioner';
import { LabelPositionerContext } from './LabelPositionerContext';
import { SceneRegistrationContext } from '../compiler/SceneRegistrationContext';
import type { SceneRegistrationValue } from '../compiler/SceneRegistrationContext';
import { clearCache } from '../compiler/sceneTrackCache';
import { serializeJsx } from './serializeJsx';
import {
  setSceneRuntimeState,
  setEngineSnapshot,
  unregisterSceneRuntime,
} from './ScenePlayerRegistry';
import { SceneMetaWidget } from './SceneMetaWidget';
import type { InternalSceneSpec } from './engineTypes';
import type { SceneModel } from '../elements/model/types';
import type { SceneNavInputMap } from '../input/types';
import type { CompileWarning } from '../compiler/sceneTrackTypes';

export type EngineProviderProps = {
  /** When provided, registers engine state in the global registry for useSceneEngineState(id). */
  id?: string;
  manifestUrl: string;
  /**
   * Composable widget plugins. Each plugin contributes widgets and DSL handlers.
   * Evaluated in array order. Use corePlugin() from @brewsite/core for built-in
   * widgets, and modelPlugin() from @brewsite/model for model and label support.
   *
   * When provided, `widgetSetup` is ignored (plugins wins).
   *
   * @example
   * plugins={[corePlugin(), modelPlugin({ manifestUrl: '/assets/manifest.json' })]}
   */
  plugins?: WidgetPlugin[];
  /**
   * @deprecated Use `plugins` instead. Will be removed in the next major version.
   * Provides backward compatibility for existing widgetSetup-based integrations.
   */
  widgetSetup?: (manifest: AssetManifest) => WidgetRegistry;
  fpsCap?: number;
  pixelsPerScene?: number;
  framesPerTick?: number;
  quality?: 'performance' | 'balanced' | 'high';
  onReady?: () => void;
  onError?: (error: Error) => void;
  onManifestError?: (error: Error) => void;
  onWidgetError?: (widgetId: string, error: Error) => void;
  onCompileWarning?: (warnings: CompileWarning[]) => void;
  onSceneChange?: (sceneId: string, sceneIndex: number) => void;
  defaultModelStates?: Partial<Record<string, Partial<SceneModel>>>;
  inputMap?: SceneNavInputMap;
  controlledProgress?: number;
  onControlledProgressChange?: (p: number) => void;
  /** All children — <Scene> declarations, layout, overlay hosts, siblings. */
  children: ReactNode;
};

const QUALITY_PRESET_FRAMES: Record<NonNullable<EngineProviderProps['quality']>, number> = {
  performance: 30,
  balanced: 60,
  high: 120,
} as const;

export const EngineProvider = (props: EngineProviderProps): ReactElement => {
  const [manifest, setManifest] = useState<AssetManifest | null>(null);

  // Scene registration — same mechanism as ScenePlayer today
  const registrationsRef = useRef(new Map<string, ReactElement>());
  const lastContentKeyRef = useRef('');
  const [scenes, setScenes] = useState<InternalSceneSpec[]>([]);

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

  // Sync scenes on every render (same pattern as ScenePlayer)
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

  // Manifest fetch
  useEffect(() => {
    let cancelled = false;
    fetch(props.manifestUrl)
      .then((r) => r.json())
      .then((raw) => {
        if (cancelled) return;
        setManifest(assertManifestValid(raw));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const err = e instanceof Error ? e : new Error(String(e));
        props.onError?.(err);
        props.onManifestError?.(err);
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.manifestUrl]);

  // Cache cleanup on unmount
  useEffect(() => () => clearCache(), []);

  const widgetRegistry = useMemo(() => {
    // Plugins path: register handlers, create registry, register widgets.
    if (props.plugins && props.plugins.length > 0) {
      for (const plugin of props.plugins) {
        plugin.registerHandlers();
      }
      const reg = new WidgetRegistryClass({ strict: true });
      for (const plugin of props.plugins) {
        for (const widget of plugin.createWidgets()) {
          reg.register(widget);
        }
        // Optional per-plugin registry configuration (type factories, manifest wiring, etc.)
        plugin.configureRegistry?.(reg, manifest ?? null);
      }
      return reg;
    }
    // Legacy path: widgetSetup or createDefaultWidgetRegistry
    if (!manifest) return createDefaultWidgetRegistry(null, { defaultModelStates: props.defaultModelStates });
    return props.widgetSetup
      ? props.widgetSetup(manifest)
      : createDefaultWidgetRegistry(manifest, { defaultModelStates: props.defaultModelStates });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest, props.plugins, props.widgetSetup, props.defaultModelStates]);

  // Wire onSceneChange to the SceneMetaWidget
  useEffect(() => {
    const metaWidget = widgetRegistry.get('__scene_meta__');
    if (metaWidget && typeof (metaWidget as SceneMetaWidget).setOnSceneChange === 'function') {
      (metaWidget as SceneMetaWidget).setOnSceneChange(props.onSceneChange);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetRegistry, props.onSceneChange]);

  const labelPositioner = useMemo(() => new LabelPositioner(), []);
  const clipMeta = useMemo(() => (manifest ? clipMetaFromManifest(manifest) : []), [manifest]);

  const resolvedFramesPerTick =
    props.framesPerTick ??
    (props.quality !== undefined ? QUALITY_PRESET_FRAMES[props.quality] : undefined);

  const engine = useSceneEngine({
    scenes,
    widgetRegistry,
    clipMeta,
    manifest,
    fpsCap: props.fpsCap,
    pixelsPerScene: props.pixelsPerScene,
    framesPerTick: resolvedFramesPerTick,
    onReady: props.onReady,
    onError: props.onError,
    onWidgetError: props.onWidgetError,
    onCompileWarning: props.onCompileWarning,
    labelPositioner,
    inputMap: props.inputMap,
    controlledProgress: props.controlledProgress,
    onControlledProgressChange: props.onControlledProgressChange,
  });

  // Push runtime state to global registry every time relevant state changes
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

  // Push frame-level snapshot (sceneId, progress, etc.) every tick
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

  const engineState = useMemo(() => ({
    progress: engine.progress,
    sceneId: engine.frameState.sceneId,
    sceneIndex: engine.frameState.sceneIndex,
    sceneProgress: engine.frameState.sceneProgress,
  }), [engine.progress, engine.frameState]);

  // SSR policy: always render children. Contexts provide meaningful empty/default
  // values on the server so that layout, nav, and static content render correctly
  // during SSR or static generation. Engine internals (Three.js, RuntimeLoop, manifest
  // fetch) are guarded inside useSceneEngine with typeof window checks and return
  // no-op values on the server. SceneCanvas renders null on the server. This means
  // a docs page wrapping its sidebar and content column in EngineProvider gets a
  // fully-rendered HTML shell on the server that hydrates correctly on the client.
  //
  // Consumers who need a hard client-only boundary should wrap EngineProvider in a
  // Suspense boundary with a server-side fallback, or use React.lazy + dynamic import
  // with ssr: false. EngineProvider itself does not impose a client-only constraint.

  // Apply plugin wrapProvider chain (plugins in reverse order so first plugin is outermost)
  let innerContent: ReactNode = (
    <EngineStateContext.Provider value={engineState}>
      <EngineContext.Provider value={engine}>
        {props.children}
      </EngineContext.Provider>
    </EngineStateContext.Provider>
  );
  if (props.plugins) {
    for (let i = props.plugins.length - 1; i >= 0; i--) {
      const plugin = props.plugins[i]!;
      if (plugin.wrapProvider) {
        innerContent = plugin.wrapProvider(innerContent);
      }
    }
  }

  return (
    <SceneRegistrationContext.Provider value={registrationContextValue}>
      <VariableStoreContext.Provider value={engine.variableStore}>
        <LabelPositionerContext.Provider value={labelPositioner}>
          {innerContent}
        </LabelPositionerContext.Provider>
      </VariableStoreContext.Provider>
    </SceneRegistrationContext.Provider>
  );
};
