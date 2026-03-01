import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { SceneRegistrationContext } from '../compiler/SceneRegistrationContext';
import type { SceneRegistrationValue } from '../compiler/SceneRegistrationContext';
import type { WidgetRegistry } from '../widget/WidgetRegistry';
import { VariableStoreContext } from '../widget/VariableStoreContext';
import { useSceneEngine } from './useSceneEngine';
import { EngineInputRegion } from './EngineInputRegion';
import { EngineStateContext } from './EngineStateContext';
import { EngineContext } from './EngineContext';
import { HudOverlay } from '../hud/HudOverlay';
import { LabelPositioner } from './LabelPositioner';
import { LabelPositionerContext } from './LabelPositionerContext';
import { LabelItem } from '../labels/LabelItem';
import { clipMetaFromManifest, assertManifestValid } from '../elements/model/metadata';
import type { AssetManifest } from '../elements/model/metadata';
import { clearCache } from '../compiler/sceneTrackCache';
import { createDefaultWidgetRegistry } from './defaultWidgets';
import { SceneMetaWidget } from './SceneMetaWidget';
import type { SceneNavInputMap } from '../input/types';
import { TimelineWidget } from './TimelineWidget';
import type { TimelineWidgetProps } from './TimelineWidgetTypes';
import { serializeJsx } from './serializeJsx';
import { setSceneRuntimeState, unregisterSceneRuntime } from './ScenePlayerRegistry';
import { SceneInspector } from './SceneInspector';
import type { SceneModel } from '../elements/model/types';
import type { CompileWarning } from '../compiler/sceneTrackTypes';

export type InternalSceneSpec = {
  readonly sceneKey: string;
  readonly contentKey: string;
  readonly element: ReactElement;
};

export type ScenePlayerProps = {
  id?: string;
  manifestUrl: string;
  /**
   * Optional widget registry factory.
   *
   * When omitted, `createDefaultWidgetRegistry(manifest)` is used automatically.
   * When provided, this function is called only after the manifest has loaded
   * successfully — the `manifest` argument is guaranteed non-null.
   *
   * @deprecated If you previously typed this as `(manifest: AssetManifest | null)`
   * the null case will never fire under this contract; update to `(manifest: AssetManifest)`.
   */
  widgetSetup?: (manifest: AssetManifest) => WidgetRegistry;
  className?: string;
  fpsCap?: number;
  /**
   * Pixels of scroll allocated per scene. Also described as "scroll depth" in docs.
   * Higher values = slower scroll-to-advance. Default: 800.
   */
  pixelsPerScene?: number;
  framesPerTick?: number;
  /**
   * Rendering quality preset. Controls pre-baked transition frame count (framesPerTick).
   *
   * | Preset        | framesPerTick | Use case                              |
   * |---------------|---------------|---------------------------------------|
   * | 'performance' | 30            | Low-power / battery-conscious devices |
   * | 'balanced'    | 60            | Most marketing pages                  |
   * | 'high'        | 120           | Maximum smoothness, larger memory     |
   *
   * When both `quality` and `framesPerTick` are present, `framesPerTick` wins.
   * When neither is set, the internal default (10 frames) is preserved for
   * backward compatibility with existing consumers.
   */
  quality?: 'performance' | 'balanced' | 'high';
  onReady?: () => void;
  onError?: (error: Error) => void;
  /** Called when the manifest fetch fails. The engine continues with default widgets. */
  onManifestError?: (error: Error) => void;
  /** Called when a single widget fails during load or apply. Engine continues rendering other widgets. */
  onWidgetError?: (widgetId: string, error: Error) => void;
  onCompileWarning?: (warnings: CompileWarning[]) => void;
  onSceneChange?: (sceneId: string, sceneIndex: number) => void;
  /** Default model state overrides keyed by <Model id>. */
  defaultModelStates?: Partial<Record<string, Partial<SceneModel>>>;
  placeholder?: ReactNode;
  /** Input configuration for scene navigation. */
  inputMap?: SceneNavInputMap;
  /**
   * Whether to render the built-in timeline widget at the bottom.
   * Pass `true` for defaults, or a `TimelineWidgetProps` subset to configure it.
   */
  timeline?: boolean | Omit<TimelineWidgetProps, 'engine' | 'scenes'>;
  /**
   * When true, renders a `<SceneInspector>` overlay with scene list, progress
   * readouts, and click-to-jump navigation. Intended for development only.
   * Set via `debug={process.env.NODE_ENV === 'development'}` for automatic
   * removal in production builds.
   */
  debug?: boolean;
  /**
   * When provided, bypasses scroll-driven progress entirely. The engine reads
   * this value ([0, 1]) on every frame without touching `window.scrollY` or
   * `window.scrollTo`. Ideal for embedded players (e.g. inside a doc page)
   * where you control progress via buttons, RAF timers, or external state.
   *
   * The player renders with `height: 100%` when this prop is set, so the
   * containing element **must** have an explicit CSS height.
   *
   * Pair with `onControlledProgressChange` to keep UI controls in sync when
   * they call `engine.scrollToProgress()` internally.
   */
  controlledProgress?: number;
  /**
   * Called when the engine sets progress via `scrollToProgress` while
   * `controlledProgress` is active. Wire to the same state setter that feeds
   * `controlledProgress` to complete the controlled-component loop.
   */
  onControlledProgressChange?: (p: number) => void;
  /**
   * Scene content. Direct <Scene id="..."> elements and React components that
   * render <Scene> are both supported.
   */
  children: ReactNode;
};

const QUALITY_PRESET_FRAMES: Record<NonNullable<ScenePlayerProps['quality']>, number> = {
  performance: 30,
  balanced: 60,
  high: 120,
} as const;

export const ScenePlayer = (props: ScenePlayerProps): ReactElement | null => {
  const [manifest, setManifest] = useState<AssetManifest | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);

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

  useEffect(() => {
    const specs = Array.from(registrationsRef.current.entries()).map(
      ([id, element]): InternalSceneSpec => ({
        sceneKey: id,
        contentKey: serializeJsx(element),
        element,
      }),
    );
    const contentKey = specs.map((spec) => spec.contentKey).join('|||');
    if (contentKey === lastContentKeyRef.current) return;
    lastContentKeyRef.current = contentKey;
    setScenes(specs);
  });

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
        setLoadError(err);
        props.onError?.(err);
        props.onManifestError?.(err);
      });
    return () => {
      cancelled = true;
    };
  }, [props.manifestUrl, props.onError]);

  useEffect(() => () => clearCache(), []);

  const isBrowser = typeof window !== 'undefined';

  const widgetRegistry = useMemo(() => {
    if (!manifest) return createDefaultWidgetRegistry(null, { defaultModelStates: props.defaultModelStates });
    return props.widgetSetup
      ? props.widgetSetup(manifest)
      : createDefaultWidgetRegistry(manifest, { defaultModelStates: props.defaultModelStates });
  }, [manifest, props.widgetSetup, props.defaultModelStates]);

  useEffect(() => {
    const metaWidget = widgetRegistry.get('__scene_meta__');
    if (metaWidget && typeof (metaWidget as SceneMetaWidget).setOnSceneChange === 'function') {
      (metaWidget as SceneMetaWidget).setOnSceneChange(props.onSceneChange);
    }
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

  const assetsReady = engine.debug?.assetsReady ?? false;
  const viewport = engine.debug?.viewport ?? { width: 1, height: 1 };

  useEffect(() => {
    const playerId = props.id;
    if (!playerId) return undefined;
    setSceneRuntimeState(playerId, {
      assetsReady,
      viewport: {
        width: viewport.width,
        height: viewport.height,
        aspectRatio: viewport.width / Math.max(1, viewport.height),
      },
      variables: engine.variableStore,
      numScenes: scenes.length,
    });
    return () => unregisterSceneRuntime(playerId);
  }, [props.id, assetsReady, viewport.width, viewport.height, engine.variableStore, scenes.length]);

  const engineState = useMemo(() => ({
    progress: engine.progress,
    sceneId: engine.frameState.sceneId,
    sceneIndex: engine.frameState.sceneIndex,
    sceneProgress: engine.frameState.sceneProgress,
  }), [engine.progress, engine.frameState]);

  const labels = engine.frameState.tick?.labelPrimitives ?? [];
  const showPlaceholder = props.placeholder && engine.frameState.tickIndex < 0;

  if (!isBrowser) {
    return (props.placeholder ?? null) as ReactElement | null;
  }

  const isControlled = props.controlledProgress !== undefined;

  return (
    <SceneRegistrationContext.Provider value={registrationContextValue}>
      <VariableStoreContext.Provider value={engine.variableStore}>
        <LabelPositionerContext.Provider value={labelPositioner}>
          <EngineStateContext.Provider value={engineState}>
            <EngineContext.Provider value={engine}>
              {/* height: 100% in controlled mode so the canvas fills the parent
                  container (e.g. a 420px DemoScene wrapper). In scroll mode the
                  height is determined by the tall EngineInputRegion spacer. */}
              <div
                className={props.className}
                style={{ position: 'relative', ...(isControlled ? { height: '100%' } : {}) }}
              >
                {loadError && <div role="alert">Scene engine error: {loadError.message}</div>}
                {showPlaceholder && (
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    {props.placeholder}
                  </div>
                )}
                <EngineInputRegion engine={engine} fillContainer={isControlled}>
                  <>
                    {props.children}
                    <HudOverlay items={engine.frameState.tick?.hudPrimitives ?? []} />
                    {labels.map((label) => (
                      <LabelItem key={label.id} label={label} />
                    ))}
                    {props.timeline && (
                      <TimelineWidget
                        engine={engine}
                        scenes={scenes.map((scene) => ({ id: scene.sceneKey }))}
                        {...(typeof props.timeline === 'object' ? props.timeline : {})}
                      />
                    )}
                    {props.debug && (
                      <SceneInspector scenes={scenes} />
                    )}
                  </>
                </EngineInputRegion>
              </div>
            </EngineContext.Provider>
          </EngineStateContext.Provider>
        </LabelPositionerContext.Provider>
      </VariableStoreContext.Provider>
    </SceneRegistrationContext.Provider>
  );
};
