// useSceneEngine.ts — Core engine hook: compilation, RAF loop, widget dispatch, and progress control.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import * as THREE from 'three';
import type { SceneDefinition } from '../compiler/sceneTypes';
import { compileSceneTrack } from '../compiler/sceneTrackCompiler';
import { buildSceneTrackKey, getCachedTrack, setCachedTrack } from '../compiler/sceneTrackCache';
import type { SceneTrack, CompileWarning } from '../compiler/sceneTrackTypes';
import { RuntimeDriverImpl } from '../runtime/RuntimeDriver';
import { RuntimeLoop } from '../runtime/RuntimeLoop';
import { VariableStore } from '../widget/VariableStore';
import type { WidgetRegistry } from '../widget/WidgetRegistry';
import type { WidgetPlugin } from '../widget/WidgetPlugin';
import { EngineFrameDriver } from './EngineFrameDriver';
import type {
  EngineFrameState,
  EngineTimingProfile,
  InternalSceneSpec,
} from './engineTypes';
import type { AssetManifest } from '../widget/types';
import type { CameraOverrideState } from '../elements/camera/types';
import { SceneProgressMapper } from './SceneProgressMapper';
import { formatBreadcrumbChain } from '../compiler/dslSourceInfo';
import type { SceneTheme, ActiveTheme } from '../theme/types';
import { clamp01 } from '../math';
import {
  createTransitionAnimatorState,
  beginTransition as beginTransitionFn,
  interruptTransition as interruptTransitionFn,
  redirectTransition as redirectTransitionFn,
  getTransitionProgress,
} from '../input/transitionAnimator';
import type { TransitionEasing } from '../input/transitionAnimator';
const SCENE_THEME_USERDATA_KEY = '__brewsite_scene_theme';

export type UseSceneEngineOptions = {
  scenes: InternalSceneSpec[];
  widgetRegistry: WidgetRegistry;
  plugins?: WidgetPlugin[];
  manifest: AssetManifest | null;
  sceneTheme?: SceneTheme | null;
  /** Active theme selection — propagated into scene compilation for NodeHandlers. */
  activeTheme?: ActiveTheme;
  timingProfile?: EngineTimingProfile;
  maxAnimBoostPerFrame?: number;
  invalidateCacheToken?: number | string;
  /** Widget ID of the primary camera. Used by ActionInput for orbit/dolly dispatch. Default: 'camera'. */
  primaryCameraId?: string;
  /** Widget ID of the primary canvas action target. Used by ActionInput for unknown action dispatch. */
  primaryCanvasActionTargetId?: string;
  /** Default duration (ms) for programmatic scene transition animations. Default: 400ms. */
  defaultTransitionDuration?: number;
  /** Default easing for programmatic scene transition animations. Default: easeInOut. */
  defaultTransitionEasing?: TransitionEasing;
  onReady?: () => void;
  onError?: (error: Error) => void;
  onWidgetError?: (widgetId: string, error: Error) => void;
  onCompileWarning?: (warnings: CompileWarning[]) => void;
};

export type UseSceneEngineResult = {
  // ── Frame state ───────────────────────────────────────────────────────────────
  frameState: EngineFrameState;
  progress: number;

  // ── Asset state ───────────────────────────────────────────────────────────────
  variableStore: VariableStore;

  // ── Canvas wiring ─────────────────────────────────────────────────────────────
  /** Ref to the canvas element managed by SceneCanvas. Used by ActionInput for pointer/wheel events. */
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  setCanvasRef(el: HTMLCanvasElement | null): void;
  setViewportSize(w: number, h: number): void;
  setBackgroundRef(el: HTMLDivElement | null): void;

  // ── Progress control ──────────────────────────────────────────────────────────
  /**
   * Directly updates the engine's controlled progress [0..1] without a React re-render.
   * Use in scroll or pointer event handlers where React state updates are too expensive.
   * Only meaningful when the engine is in controlled-progress mode.
   */
  setControlledProgress: (p: number) => void;

  /** Pauses the RuntimeLoop RAF cycle. Delegates to RuntimeLoop.pause(). */
  pause: () => void;

  /** Resumes the RuntimeLoop RAF cycle after pause(). Delegates to RuntimeLoop.resume(). */
  resume: () => void;

  /**
   * Write raw (pre-mapper) scroll-space progress [0, 1].
   * Used ONLY by ScrollInput source='window' and source={elementRef}.
   * Goes through SceneProgressMapper if one exists (scroll-units mode).
   * DO NOT use this for inertia, keyboard, time, pointer, or controlled inputs.
   */
  setRawProgress(raw: number): void;

  /**
   * Write post-mapper engine progress [0, 1] directly, bypassing the
   * SceneProgressMapper. Used by ControlledInput, inertia mode, keyboard, time,
   * and pointer inputs that operate in engine progress space rather than scroll space.
   */
  setProgress(mapped: number): void;

  /**
   * Advance engine progress by a signed delta in engine progress space [−1..+1].
   * Clamps result to [0, 1]. Used by TimeInput and keyboard step navigation.
   * Equivalent to setProgress(currentProgress + delta).
   */
  advanceProgress(delta: number): void;

  // ── Compiled scene info ───────────────────────────────────────────────────────
  /** The compiled SceneTrack. Null until the first compile completes. */
  sceneTrack: SceneTrack | null;

  /** Number of compiled scenes. 0 until compile completes. */
  sceneCount: number;

  /** Ordered list of compiled scenes (id + index). Empty until compile completes. */
  compiledScenes: ReadonlyArray<{ id: string; index: number }>;

  /**
   * The SceneProgressMapper derived from the compiled track's progressProfile.
   * Null when all scenes have equal scroll weight (identity mapping).
   */
  progressMapper: SceneProgressMapper | null;

  // ── Action input wiring ───────────────────────────────────────────────────────
  /** Widget ID of the primary camera. Passed to ActionInputController as idDefaults.cameraId. */
  readonly primaryCameraId: string;
  /** Widget ID of the primary canvas action target. Passed to ActionInputController as idDefaults.canvasId. */
  readonly primaryCanvasActionTargetId: string;

  /**
   * Apply an orbital rotation delta to the camera. Delegates to CameraWidget.applyCameraOrbit().
   * No-op with console.warn if the camera widget is not found or does not support orbit.
   */
  applyCameraOrbit(cameraId: string, dx: number, dy: number, speed: number): void;

  /**
   * Apply a dolly (zoom) delta along the camera's forward axis. Delegates to CameraWidget.applyCameraDolly().
   * No-op with console.warn if the camera widget is not found or does not support dolly.
   */
  applyCameraDolly(cameraId: string, delta: number, speed: number): void;

  /**
   * Apply a zoom delta. Alias for applyCameraDolly — wired to the 'camera.zoom' action type.
   */
  applyCameraZoom(cameraId: string, delta: number, speed: number): void;

  /**
   * Apply a pan delta in the camera's local XY plane. Delegates to CameraWidget.applyCameraPan().
   * No-op with console.warn if the camera widget is not found or does not support pan.
   */
  applyCameraPan(cameraId: string, dx: number, dy: number, speed: number): void;

  /** Reset the camera override. Equivalent to setCameraOverride(null). */
  applyCameraReset(cameraId: string): void;

  /**
   * Begin a programmatic scene transition animation from the current engine progress
   * to `toProgress` over `durationMs` milliseconds.
   * If a transition is already active, it is interrupted and the new transition starts
   * from the current interpolated progress.
   */
  beginTransition(toProgress: number, durationMs?: number, easing?: TransitionEasing): void;

  /**
   * Interrupt the active transition. Engine progress stays at the current value.
   * No-op when no transition is active.
   */
  interruptTransition(): void;

  /**
   * Redirect an active transition to a new target without restarting the easing curve.
   * If no transition is active, starts a new transition from the current progress.
   */
  redirectTransition(newToProgress: number, durationMs?: number, easing?: TransitionEasing): void;

  /**
   * Apply per-widget state patches that override compiled SceneTrack state for this tick.
   * Used by dynamic widget overrides (e.g., carousel scrubbing). Patches are cleared by
   * calling with an empty object.
   */
  patchWidgetStates(patches: Record<string, unknown>): void;

  // ── Camera control ────────────────────────────────────────────────────────────
  getCamera(): THREE.PerspectiveCamera | null;
  getRenderer(): THREE.WebGLRenderer | null;
  setCameraOverride(next: CameraOverrideState | null): void;
  getCameraOverride(): CameraOverrideState | null;
  setAutoAdvancePaused(paused: boolean): void;

  // ── Overlay content ───────────────────────────────────────────────────────────
  sceneOverlays: Map<string, ReactNode>;

  debug?: {
    assetsReady: boolean;
    viewport: { width: number; height: number };
  };
};


const DEFAULT_BLOCK_SIZE = 10;
const QUALITY_PRESET_BLOCK_SIZE: Record<NonNullable<EngineTimingProfile['qualityPreset']>, number> = {
  performance: 30,
  balanced: 60,
  high: 120,
} as const;


const makeInitialFrameState = (firstSceneId = ''): EngineFrameState => ({
  tickIndex: -1,
  progress: 0,
  sceneId: firstSceneId,
  sceneIndex: 0,
  sceneProgress: 0,
  tick: null,
});

export const useSceneEngine = (options: UseSceneEngineOptions): UseSceneEngineResult => {
  const variableStore = useMemo(() => new VariableStore(), []);
  const [frameState, setFrameState] = useState<EngineFrameState>(
    () => makeInitialFrameState(options.scenes[0]?.sceneKey ?? ''),
  );
  const [assetsReady, setAssetsReady] = useState(false);
  const [driverReady, setDriverReady] = useState(false);
  const [sceneTrack, setSceneTrack] = useState<SceneTrack | null>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [backgroundElement, setBackgroundElement] = useState<HTMLDivElement | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const cameraOverrideRef = useRef<CameraOverrideState | null>(null);
  const driverRef = useRef<RuntimeDriverImpl | null>(null);
  const loopRef = useRef<RuntimeLoop | null>(null);
  const frameDriverRef = useRef<EngineFrameDriver | null>(null);
  const readyRef = useRef(false);
  const viewportRef = useRef({ width: 1, height: 1 });

  // ─── Progress refs ─────────────────────────────────────────────────────────
  // Written by input components via setRawProgress / setProgress.
  // Read by getGlobalProgress() inside the RAF loop on every frame.
  const progressRef = useRef(0);
  const rawProgressRef = useRef(0);
  const progressMapperRef = useRef<SceneProgressMapper | null>(null);

  // ─── Transition animator state ──────────────────────────────────────────────
  // Mutable state for programmatic scene transition animations.
  // Owned by this hook; read each frame in getGlobalProgress().
  const transitionRef = useRef(createTransitionAnimatorState());

  // Keep option refs for getGlobalProgress closure (avoids stale captures)
  const defaultTransitionDurationRef = useRef(options.defaultTransitionDuration);
  defaultTransitionDurationRef.current = options.defaultTransitionDuration;
  const defaultTransitionEasingRef = useRef(options.defaultTransitionEasing);
  defaultTransitionEasingRef.current = options.defaultTransitionEasing;

  // ─── Progress mapper ────────────────────────────────────────────────────────
  const progressMapper = useMemo<SceneProgressMapper | null>(() => {
    if (!sceneTrack?.progressProfile || sceneTrack.progressProfile.isUniform) {
      return null;
    }
    return new SceneProgressMapper(sceneTrack.progressProfile);
  }, [sceneTrack]);

  // Keep ref in sync with derived progressMapper memo value.
  progressMapperRef.current = progressMapper;

  // ─── Scene derived info ─────────────────────────────────────────────────────
  const sceneCount = sceneTrack?.sceneWindows?.length ?? 0;

  const compiledScenes = useMemo<ReadonlyArray<{ id: string; index: number }>>(
    () => sceneTrack?.sceneWindows?.map((w) => ({ id: w.id, index: w.index })) ?? [],
    [sceneTrack],
  );

  // ─── Progress write methods ─────────────────────────────────────────────────

  /**
   * Write raw scroll-space progress through the mapper (if present).
   * Use for ScrollInput source='window' and source={elementRef} only.
   */
  const setRawProgress = useCallback((raw: number) => {
    const clamped = clamp01(raw);
    rawProgressRef.current = clamped;
    const mapped = progressMapperRef.current
      ? progressMapperRef.current.remap(clamped)
      : clamped;
    progressRef.current = mapped;
  }, []);

  /**
   * Write engine progress directly, bypassing the mapper.
   * Use for inertia, keyboard, time, pointer, and controlled inputs.
   */
  const setProgress = useCallback((mapped: number) => {
    const clamped = clamp01(mapped);
    progressRef.current = clamped;
    // Also set rawProgressRef to the inverse so subsequent setRawProgress calls
    // in the same frame don't clobber this value.
    rawProgressRef.current = progressMapperRef.current
      ? progressMapperRef.current.inverse(clamped)
      : clamped;
  }, []);

  /**
   * Advance engine progress by a signed delta. Clamps to [0, 1].
   */
  const advanceProgress = useCallback((delta: number) => {
    setProgress(clamp01(progressRef.current + delta));
  }, [setProgress]);

  // ─── getGlobalProgress: read by RuntimeLoop every frame ─────────────────────
  // Also advances any active transition animation by sampling the transition state.
  const getGlobalProgress = useCallback((): number => {
    const transitionProgress = getTransitionProgress(transitionRef.current, performance.now());
    if (transitionProgress !== null) {
      // Transition is active — update progressRef so all callers see the animated value.
      const clamped = clamp01(transitionProgress);
      progressRef.current = clamped;
      rawProgressRef.current = progressMapperRef.current
        ? progressMapperRef.current.inverse(clamped)
        : clamped;
    }
    return progressRef.current;
  }, []);

  const setCameraOverrideInternal = useCallback((next: CameraOverrideState | null) => {
    cameraOverrideRef.current = next;
    driverRef.current?.setCameraOverride(next ?? null);
  }, []);

  // ─── setAutoAdvancePaused (stub — player-level auto-advance removed) ──────────
  // Per-scene auto-advance is now exclusively managed inside RuntimeDriverImpl.
  const setAutoAdvancePaused = useCallback((_paused: boolean) => {
    // no-op: player-level auto-advance state machine has been removed in v2.
  }, []);

  // ─── blockSize ──────────────────────────────────────────────────────────────
  const blockSize = useMemo(() => {
    const qualityPreset = options.timingProfile?.qualityPreset;
    const qualityBlockSize = qualityPreset ? QUALITY_PRESET_BLOCK_SIZE[qualityPreset] : undefined;
    const resolved = options.timingProfile?.blockSize ?? qualityBlockSize ?? DEFAULT_BLOCK_SIZE;
    return Math.max(1, Math.round(resolved));
  }, [options.timingProfile]);

  const resolvedFpsCap = options.timingProfile?.fpsCap;

  const sceneDefs = useMemo(
    (): SceneDefinition[] =>
      options.scenes.map((spec) => ({
        id: spec.sceneKey,
        getFrame: () => spec.element,
      })),
    [options.scenes],
  );

  // ─── Reduced motion media query ─────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    if (typeof (media as MediaQueryList).addListener === 'function') {
      (media as MediaQueryList).addListener(update);
      return () => (media as MediaQueryList).removeListener(update);
    }
    return undefined;
  }, []);

  // ─── Canvas ref ─────────────────────────────────────────────────────────────
  const setCanvasRef = useCallback((next: HTMLCanvasElement | null) => {
    setCanvas(next);
    canvasElementRef.current = next;
    // After registering canvas with renderer:
    loopRef.current?.setCanvas(next); // el is the canvas element, null on unregister
  }, []);

  // ─── Background ref ─────────────────────────────────────────────────────────
  const setBackgroundRef = useCallback((next: HTMLDivElement | null) => {
    setBackgroundElement(next);
  }, []);

  // ─── Viewport size ──────────────────────────────────────────────────────────
  const setViewportSize = useCallback((width: number, height: number) => {
    viewportRef.current = { width, height };
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (renderer) renderer.setSize(width, height, false);
    if (camera) {
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    }
    // Propagate to RuntimeDriverImpl so the NVS coordinate service uses the real
    // canvas dimensions instead of the 1920×1080 fallback.
    driverRef.current?.setViewportSize(width, height);
  }, []);

  const setCameraOverride = setCameraOverrideInternal;
  const getCameraOverride = useCallback(() => cameraOverrideRef.current, []);

  // ─── WebGL renderer lifecycle ───────────────────────────────────────────────
  useEffect(() => {
    if (!canvas || typeof window === 'undefined') return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio ?? 1);
    if (typeof renderer.setClearColor === 'function') {
      renderer.setClearColor(0x000000, 0);
    }
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;
    options.widgetRegistry.notifyRendererCreated(renderer);
    const onContextLost = (event: Event) => { event.preventDefault(); };
    const onContextRestored = () => {
      console.warn('[SceneEngine] WebGL context restored — reinitializing renderer.');
      // DEBT: Full renderer re-initialization not yet implemented. The engine will not
      // recover from GPU context loss. RuntimeLoop handles pause/resume via its own
      // webglcontextlost/webglcontextrestored listeners on the canvas element.
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);
    const { width, height } = viewportRef.current;
    renderer.setSize(width, height, false);

    return () => {
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      options.widgetRegistry.notifyRendererDisposing(renderer);
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [canvas]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Background widget DOM wiring ───────────────────────────────────────────
  useEffect(() => {
    const backgroundWidget = options.widgetRegistry.get('background');
    // DEBT: Replace with typed IHasDomElement interface
    const backgroundWithDom = backgroundWidget as unknown as { setDomElement?: (el: HTMLElement | null) => void } | undefined;
    if (!backgroundWithDom || typeof backgroundWithDom.setDomElement !== 'function') return;
    backgroundWithDom.setDomElement(backgroundElement);
  }, [backgroundElement, options.widgetRegistry]);

  // ─── RuntimeDriver lifecycle ────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !canvas) return;
    readyRef.current = false;
    setDriverReady(false);
    setAssetsReady(false);
    setFrameState(makeInitialFrameState());
    if (!sceneTrack) return;

    const scene = new THREE.Scene();
    (
      scene.userData as Record<string, unknown>
    )[SCENE_THEME_USERDATA_KEY] = options.sceneTheme ?? null;
    const initialViewport = viewportRef.current;
    const initialAspect = initialViewport.width / Math.max(1, initialViewport.height);
    const camera = new THREE.PerspectiveCamera(45, initialAspect, 0.01, 100);
    camera.position.set(2.71, 2.35, 2.71);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    sceneRef.current = scene;
    cameraRef.current = camera;

    const driver = new RuntimeDriverImpl({
      widgetRegistry: options.widgetRegistry,
      variableStore,
      manifest: options.manifest ?? null,
      maxAnimBoostPerFrame: options.maxAnimBoostPerFrame,
      onAssetsReady: () => setAssetsReady(true),
      onError: options.onError,
      onWidgetError: options.onWidgetError,
    });
    driverRef.current = driver;

    // Seed the driver with the current viewport size so the NVS coordinate service
    // uses real canvas dimensions from the very first tick.
    driver.setViewportSize(initialViewport.width, initialViewport.height);

    try {
      driver.initialize(scene, camera, rendererRef.current ?? undefined);
      if (cameraOverrideRef.current) {
        driver.setCameraOverride(cameraOverrideRef.current);
      }
      setDriverReady(true);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      options.onError?.(err);
    }

    return () => {
      driver.dispose();
      driverRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      loopRef.current?.stop();
      loopRef.current = null;
      frameDriverRef.current?.reset();
    };
  }, [
    canvas,
    options.widgetRegistry,
    // options.sceneTheme intentionally excluded — theme changes do not require
    // tearing down the Three.js scene/camera/widgets. The lightweight sync effect
    // below updates scene.userData, and scene recompilation (driven by sceneDefs
    // changes when scene components re-render with new theme props) flows through
    // driver.setSceneTrack() in the RAF loop effect.
    options.onError,
    options.manifest,
    options.maxAnimBoostPerFrame,
    variableStore,
    // Use boolean sentinel (!!sceneTrack) instead of the track object itself.
    // The lifecycle needs to fire when sceneTrack transitions null↔non-null
    // (initial creation / full teardown), but subsequent track recompilations
    // (theme change, content edit) are handled by driver.setSceneTrack() in the
    // RAF loop effect — no driver rebuild needed.
    !!sceneTrack,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep scene-level theme userData in sync for already-initialized scenes.
  // This is used by FloorWidget and potentially other elements that read theme
  // from scene.userData at render time. The carousel tray resolves its theme
  // at compile time (baked into compiled state) and does NOT read from here.
  //
  // KNOWN LIMITATION: This effect uses Object.is reference equality on
  // options.sceneTheme. The scene theme registry (resolveSceneTheme) returns
  // the same constant object reference for a given family+polarity pair.
  // When toggling polarity back to a previously-seen value, this effect
  // fires (the options.sceneTheme prop reference changes from the caller),
  // but downstream useEffect deps on scene.userData[theme] may NOT fire
  // if they captured the same object reference previously.
  //
  // Elements that need reliable theme updates should resolve theme at compile
  // time (via resolveSceneTheme in their NodeHandler), not at render time via
  // scene.userData. The carousel tray was migrated to compile-time resolution
  // for exactly this reason. See viewHandlers.ts CarouselTray detection block.
  useEffect(() => {
    if (!sceneRef.current) return;
    (
      sceneRef.current.userData as Record<string, unknown>
    )[SCENE_THEME_USERDATA_KEY] = options.sceneTheme ?? null;
  }, [options.sceneTheme]);

  // ─── Scene track compilation ────────────────────────────────────────────────
  // Compiles as soon as scenes are available. Manifest is no longer a prerequisite
  // for compilation — widget asset loading is handled independently by ILoadable
  // widgets in each plugin's createWidgets(). The old manifest-null guard has been
  // removed; keeping it would permanently block compilation in SceneEngine v2
  // where manifest is always null.
  useEffect(() => {
    if (options.scenes.length === 0) {
      setSceneTrack(null);
      return;
    }
    const reconcileCompiledTrack = (track: SceneTrack): SceneTrack => {
      for (const plugin of options.plugins ?? []) {
        plugin.reconcileCompiledTrack?.(options.widgetRegistry, track);
      }
      return track;
    };
    const key = buildSceneTrackKey({
      scenes: options.scenes,
      widgetRegistry: options.widgetRegistry,
      blockSize,
      prefersReducedMotion,
      invalidateCacheToken: options.invalidateCacheToken,
      activeTheme: options.activeTheme,
    });
    const cached = getCachedTrack(key);
    if (cached) {
      setSceneTrack(reconcileCompiledTrack(cached));
      return;
    }

    const compiled = compileSceneTrack({
      scenes: sceneDefs,
      widgetRegistry: options.widgetRegistry,
      blockSize,
      prefersReducedMotion,
      activeTheme: options.activeTheme,
    });
    if (compiled.warnings?.length) {
      for (const warning of compiled.warnings) {
        if (warning.elementAncestry && warning.elementAncestry.length > 0) {
          console.warn(
            `[BrewSite] ${warning.message}\n  DSL ancestry: ${formatBreadcrumbChain(warning.elementAncestry)}`,
          );
        } else {
          console.warn(`[BrewSite] ${warning.message}`);
        }
      }
      if (options.onCompileWarning) {
        options.onCompileWarning(compiled.warnings);
      }
    }
    const reconciled = reconcileCompiledTrack(compiled);
    setCachedTrack(key, reconciled);
    setSceneTrack(reconciled);
  }, [
    options.scenes,
    options.widgetRegistry,
    options.plugins,
    blockSize,
    prefersReducedMotion,
    sceneDefs,
    options.invalidateCacheToken,
    options.activeTheme,
    options.onCompileWarning,
  ]);

  // ─── RAF loop lifecycle ─────────────────────────────────────────────────────
  useEffect(() => {
    const driver = driverRef.current;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!driver || !renderer || !scene || !camera || !sceneTrack || !driverReady) return;

    driver.setSceneTrack(sceneTrack);
    const frameDriver = new EngineFrameDriver((state) => setFrameState(state));
    frameDriverRef.current = frameDriver;

    const loop = new RuntimeLoop({
      driver,
      getGlobalProgress,
      render: () => {
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, renderer.domElement.clientWidth, renderer.domElement.clientHeight);
        renderer.render(scene, camera);

        const extraPasses = options.widgetRegistry.getExtraRenderPassWidgets();
        if (extraPasses.length > 0) {
          const w = renderer.domElement.clientWidth;
          const h = renderer.domElement.clientHeight;
          for (const pass of extraPasses) {
            pass.renderPass(renderer, w, h);
          }
        }
      },
      onAfterTick: () => {
        frameDriver.handleTick(driver.getCurrentTick());
      },
      fpsCap: resolvedFpsCap,
    });

    loopRef.current = loop;
    loop.start();
    if (driverReady && !readyRef.current) {
      readyRef.current = true;
      options.onReady?.();
    }

    return () => {
      loop.stop();
      loopRef.current = null;
      frameDriver.reset();
    };
  }, [sceneTrack, getGlobalProgress, resolvedFpsCap, options.onReady, driverReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const setControlledProgress = useCallback((p: number) => {
    // Update the same ref that getGlobalProgress() reads.
    // Bypasses React render cycle — safe to call in passive scroll handlers.
    progressRef.current = p;
  }, []);

  // ─── Camera orbit/dolly/reset dispatch ─────────────────────────────────────
  const applyCameraOrbit = useCallback((cameraId: string, dx: number, dy: number, speed: number) => {
    const widget = options.widgetRegistry.get(cameraId);
    if (!widget || !('applyCameraOrbit' in widget)) {
      console.warn(`[ActionInput] Camera widget "${cameraId}" not found or does not support orbit.`);
      return;
    }
    (widget as { applyCameraOrbit: (dx: number, dy: number, speed: number) => void }).applyCameraOrbit(dx, dy, speed);
  }, [options.widgetRegistry]);

  const applyCameraDolly = useCallback((cameraId: string, delta: number, speed: number) => {
    const widget = options.widgetRegistry.get(cameraId);
    if (!widget || !('applyCameraDolly' in widget)) {
      console.warn(`[ActionInput] Camera widget "${cameraId}" not found or does not support dolly.`);
      return;
    }
    (widget as { applyCameraDolly: (delta: number, speed: number) => void }).applyCameraDolly(delta, speed);
  }, [options.widgetRegistry]);

  const applyCameraZoom = useCallback((cameraId: string, delta: number, speed: number) => {
    // camera.zoom maps to the same underlying dolly operation.
    const widget = options.widgetRegistry.get(cameraId);
    if (!widget || !('applyCameraDolly' in widget)) {
      console.warn(`[ActionInput] Camera widget "${cameraId}" not found or does not support zoom.`);
      return;
    }
    (widget as { applyCameraDolly: (delta: number, speed: number) => void }).applyCameraDolly(delta, speed);
  }, [options.widgetRegistry]);

  const applyCameraPan = useCallback((cameraId: string, dx: number, dy: number, speed: number) => {
    const widget = options.widgetRegistry.get(cameraId);
    if (!widget || !('applyCameraPan' in widget)) {
      console.warn(`[ActionInput] Camera widget "${cameraId}" not found or does not support pan.`);
      return;
    }
    (widget as { applyCameraPan: (dx: number, dy: number, speed: number) => void }).applyCameraPan(dx, dy, speed);
  }, [options.widgetRegistry]);

  const applyCameraReset = useCallback((_cameraId: string) => {
    setCameraOverrideInternal(null);
  }, [setCameraOverrideInternal]);

  const handleBeginTransition = useCallback((
    toProgress: number,
    durationMs?: number,
    easing?: TransitionEasing,
  ) => {
    beginTransitionFn(
      transitionRef.current,
      progressRef.current,
      toProgress,
      performance.now(),
      durationMs ?? defaultTransitionDurationRef.current,
      easing ?? defaultTransitionEasingRef.current,
    );
  }, []);

  const handleInterruptTransition = useCallback(() => {
    interruptTransitionFn(transitionRef.current);
  }, []);

  const handleRedirectTransition = useCallback((
    newToProgress: number,
    durationMs?: number,
    easing?: TransitionEasing,
  ) => {
    redirectTransitionFn(
      transitionRef.current,
      progressRef.current,
      newToProgress,
      performance.now(),
      durationMs ?? defaultTransitionDurationRef.current,
      easing ?? defaultTransitionEasingRef.current,
    );
  }, []);

  const patchWidgetStates = useCallback((patches: Record<string, unknown>) => {
    driverRef.current?.setWidgetStatePatches(patches);
  }, []);

  const pause = useCallback(() => {
    loopRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    loopRef.current?.resume();
  }, []);

  return {
    frameState,
    progress: frameState.progress,
    variableStore,
    canvasRef: canvasElementRef,
    setCanvasRef,
    setViewportSize,
    setBackgroundRef,
    setControlledProgress,
    pause,
    resume,
    setRawProgress,
    setProgress,
    advanceProgress,
    primaryCameraId: options.primaryCameraId ?? 'camera',
    primaryCanvasActionTargetId: options.primaryCanvasActionTargetId ?? '',
    applyCameraOrbit,
    applyCameraDolly,
    applyCameraZoom,
    applyCameraPan,
    applyCameraReset,
    beginTransition: handleBeginTransition,
    interruptTransition: handleInterruptTransition,
    redirectTransition: handleRedirectTransition,
    patchWidgetStates,
    sceneTrack,
    sceneCount,
    compiledScenes,
    progressMapper,
    getCamera: () => cameraRef.current,
    getRenderer: () => rendererRef.current,
    setCameraOverride,
    getCameraOverride,
    setAutoAdvancePaused,
    sceneOverlays: sceneTrack?.sceneOverlays ?? new Map(),
    debug: {
      assetsReady,
      viewport: { ...viewportRef.current },
    },
  };
};
