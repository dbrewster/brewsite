// Engine creation + context provision. No DOM output — renders only contexts and children.
// Composable alternative to ScenePlayer for advanced layout patterns.

import {
  useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type ReactElement,
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
} from './ScenePlayerRegistry';
import type {
  CameraInteractionDefaults,
  EngineTimingProfile,
  InputModePolicy,
  InternalSceneSpec,
  ScrollSource,
} from './engineTypes';
import type { SceneNavInputMap } from '../input/types';
import type { CompileWarning } from '../compiler/sceneTrackTypes';
import type { AssetManifest } from '../widget/types';

export type EngineProviderProps = {
  /** When provided, registers engine state in the global registry for useSceneEngineState(id). */
  id?: string;
  manifestUrl: string;
  /**
   * Composable widget plugins. Each plugin contributes widgets and DSL handlers.
   * Evaluated in array order. Use corePlugin() from @brewsite/core for built-in
   * widgets, and modelPlugin() from @brewsite/model for model and label support.
   *
   * @example
   * plugins={[corePlugin(), modelPlugin({ manifestUrl: '/assets/manifest.json' })]}
   */
  plugins?: WidgetPlugin[];
  timingProfile?: EngineTimingProfile;
  inputModePolicy?: InputModePolicy;
  primaryCameraId?: string;
  primaryCanvasActionTargetId?: string;
  scrollSource?: ScrollSource;
  scrollHeightMode?: 'scene-count' | 'scroll-units';
  pixelsPerScrollUnit?: number;
  maxAnimBoostPerFrame?: number;
  cameraInteractionDefaults?: CameraInteractionDefaults;
  invalidateCacheToken?: number | string;
  fpsCap?: number;
  pixelsPerScene?: number;
  /**
   * Exact scroll region height in pixels. Overrides the automatic `pixelsPerScene × sceneCount`
   * calculation when set. Use this when the page has a precomputed per-scene offset system
   * (e.g. a sidebar whose navigation targets are absolute pixel values derived from
   * `scrollUnits` budgets) that must stay in sync with `window.scrollY`.
   *
   * @example
   * // Docs site: totalScrollHeight = sum of all scene scrollUnits = 73 200px
   * scrollHeightPx={TOTAL_SCROLL_HEIGHT}
   */
  scrollHeightPx?: number;
  framesPerTick?: number;
  quality?: 'performance' | 'balanced' | 'high';
  onReady?: () => void;
  onError?: (error: Error) => void;
  onManifestError?: (error: Error) => void;
  onWidgetError?: (widgetId: string, error: Error) => void;
  onCompileWarning?: (warnings: CompileWarning[]) => void;
  inputMap?: SceneNavInputMap;
  controlledProgress?: number;
  onControlledProgressChange?: (p: number) => void;
  enableKeyboardInControlledMode?: boolean;
  controlledInputMap?: SceneNavInputMap;
  /**
   * Optional scene theme token set for cross-package visual styling.
   *
   * When provided:
   * - CSS variables (font family, font sizes, color mode) are injected by
   *   EngineOverlayHost via ThemeContext. This affects all HTML overlay content.
   * - CSS variable values are static for the player lifetime — they do not
   *   change per scene. For per-scene background changes, use <Background theme={...}/>.
   *
   * WebGL font URL (sceneTheme.font.webglFontUrl) must be passed explicitly to
   * DiagramTheme.sceneTheme or ChartTheme.sceneTheme (or ChartDSL.sceneTheme) —
   * it is not automatically plumbed from EngineProvider to WebGL renderers.
   */
  sceneTheme?: SceneTheme;
  /** All children — <Scene> declarations, layout, overlay hosts, siblings. */
  children: ReactNode;
};

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
        // Minimal manifest validation. Full validation lives in @brewsite/model.
        const m = raw as Record<string, unknown>;
        if (!Array.isArray(m['models']) || !Array.isArray(m['animations'])) {
          throw new Error('[EngineProvider] Invalid manifest: missing models or animations array.');
        }
        setManifest(m as unknown as AssetManifest);
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

  const widgetRegistry = useMemo(() => {
    if (!props.plugins || props.plugins.length === 0) {
      console.error(
        '[BrewSite] EngineProvider requires a `plugins` prop. ' +
        'Pass plugins={[corePlugin(), ...]} to configure the engine.',
      );
    }
    // Register handlers, create registry, register widgets.
    if (props.plugins) {
      for (const plugin of props.plugins) {
        plugin.registerHandlers();
      }
    }
    const reg = new WidgetRegistryClass({ strict: true });
    if (props.plugins) {
      for (const plugin of props.plugins) {
        for (const widget of plugin.createWidgets()) {
          reg.register(widget);
        }
        // Optional per-plugin registry configuration (type factories, manifest wiring, etc.)
        plugin.configureRegistry?.(reg, manifest ?? null);
      }
    }
    return reg;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest, props.plugins]);

  // onSceneChange must be wired via corePlugin({ onSceneChange }) — not directly on EngineProvider.
  // This keeps SceneMetaWidget internal to the corePlugin and out of the provider's concerns.

  const resolvedTimingProfile: EngineTimingProfile = {
    fpsCap: props.timingProfile?.fpsCap ?? props.fpsCap,
    blockSize: props.timingProfile?.blockSize ?? props.framesPerTick,
    qualityPreset: props.timingProfile?.qualityPreset ?? props.quality,
  };

  const engine = useSceneEngine({
    scenes,
    widgetRegistry,
    manifest,
    timingProfile: resolvedTimingProfile,
    inputModePolicy: props.inputModePolicy,
    primaryCameraId: props.primaryCameraId,
    primaryCanvasActionTargetId: props.primaryCanvasActionTargetId,
    scrollSource: props.scrollSource,
    scrollHeightMode: props.scrollHeightMode,
    pixelsPerScrollUnit: props.pixelsPerScrollUnit,
    maxAnimBoostPerFrame: props.maxAnimBoostPerFrame,
    cameraInteractionDefaults: props.cameraInteractionDefaults,
    invalidateCacheToken: props.invalidateCacheToken,
    pixelsPerScene: props.pixelsPerScene,
    scrollHeightPx: props.scrollHeightPx,
    onReady: props.onReady,
    onError: props.onError,
    onWidgetError: props.onWidgetError,
    onCompileWarning: props.onCompileWarning,
    inputMap: props.inputMap,
    controlledProgress: props.controlledProgress,
    onControlledProgressChange: props.onControlledProgressChange,
    enableKeyboardInControlledMode: props.enableKeyboardInControlledMode,
    controlledInputMap: props.controlledInputMap,
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
    tickIndex: engine.frameState.tickIndex,
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
    <ThemeContext.Provider value={props.sceneTheme ?? null}>
      <SceneRegistrationContext.Provider value={registrationContextValue}>
        <VariableStoreContext.Provider value={engine.variableStore}>
          {innerContent}
        </VariableStoreContext.Provider>
      </SceneRegistrationContext.Provider>
    </ThemeContext.Provider>
  );
};
