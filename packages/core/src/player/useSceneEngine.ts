import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { RefObject, ReactNode } from 'react';
import type { SceneDefinition } from '../compiler/sceneTypes';
import { compileSceneTrack } from '../compiler/sceneTrackCompiler';
import { buildSceneTrackKey, getCachedTrack, setCachedTrack } from '../compiler/sceneTrackCache';
import type { SceneTrack, CompileWarning } from '../compiler/sceneTrackTypes';
import { RuntimeDriverImpl } from '../runtime/RuntimeDriver';
// ModelRenderer import removed in Phase 2 — renderer lifecycle managed via IRendererLifecycle
import { RuntimeLoop } from '../runtime/RuntimeLoop';
import { VariableStore } from '../widget/VariableStore';
import type { WidgetRegistry } from '../widget/WidgetRegistry';
import { EngineFrameDriver } from './EngineFrameDriver';
import type { EngineFrameState, InternalSceneSpec } from './engineTypes';
import { useEngineInput } from './useEngineInput';
/** Minimal asset manifest type for backward compat. Full type lives in @brewsite/model. */
type AssetManifest = { version: number; models: unknown[]; animations: unknown[] };
import type { SceneNavInputMap } from '../input/types';
import type { CameraOverrideState } from '../elements/camera/types';
import type { SceneInputControllerSpec } from '../input/types';
import { SceneProgressMapper } from './SceneProgressMapper';

export type UseSceneEngineOptions = {
  scenes: InternalSceneSpec[];
  widgetRegistry: WidgetRegistry;
  manifest?: AssetManifest | null;
  fpsCap?: number;
  pixelsPerScene?: number;
  framesPerTick?: number;
  blockSize?: number;
  onReady?: () => void;
  onError?: (error: Error) => void;
  onWidgetError?: (widgetId: string, error: Error) => void;
  onCompileWarning?: (warnings: CompileWarning[]) => void;
  inputMap?: SceneNavInputMap;
  /**
   * When provided, bypasses scroll-driven progress calculation.
   * The engine reads this value ([0, 1]) directly on every frame.
   * Forces the engine into `'direct'` input mode — no scroll spacer,
   * no `window.scrollTo` calls. The player container must supply an
   * explicit CSS height so the canvas can fill it correctly.
   */
  controlledProgress?: number;
  /**
   * Called when the engine sets progress internally (e.g., prev/next controls).
   * Wire to the same state setter that feeds `controlledProgress`.
   */
  onControlledProgressChange?: (p: number) => void;
};

export type UseSceneEngineResult = {
  frameState: EngineFrameState;
  scrollRegionRef: RefObject<HTMLDivElement | null>;
  scrollRegionHeightPx: number;
  inputMode: 'scroll' | 'direct';
  /** Current input source. 'push' when ScrollCaptureSection is providing progress. */
  inputSource: 'scroll' | 'push';
  progress: number;
  scrollToProgress: (next: number) => void;
  getGlobalProgress: () => number;
  /**
   * Push raw input progress [0..1] directly into the engine.
   * Used by ScrollCaptureSection to feed scroll-captured progress.
   * When called, switches inputSource to 'push' and bypasses the
   * window scroll listener.
   */
  setRawProgress: (raw: number) => void;
  /** Total number of scenes. Used by TimelineWidget and useEngineInput. */
  sceneCount: number;
  /** Ordered list of scene IDs from the registered scene specs. */
  sceneIds: string[];
  /**
   * Map from sceneId to overlay ReactNode for scenes that contain non-DSL children.
   * Populated from sceneTrack.sceneOverlays after compilation.
   * Used by EngineOverlayHost to render active scene content.
   */
  sceneOverlays: Map<string, ReactNode>;
  variableStore: VariableStore;
  setCanvasRef: (canvas: HTMLCanvasElement | null) => void;
  setBackgroundRef: (element: HTMLDivElement | null) => void;
  setViewportSize: (width: number, height: number) => void;
  getCamera: () => THREE.PerspectiveCamera | null;
  getRenderer: () => THREE.WebGLRenderer | null;
  setCameraOverride: (next: CameraOverrideState | null) => void;
  getCameraOverride: () => CameraOverrideState | null;
  /**
   * Pause or resume auto-advance for all scenes in this engine instance.
   * Instance-scoped — does not affect other EngineProvider instances on the same page.
   *
   * Use case: pause when a modal, tooltip, or overlay is open.
   * @example
   * useEffect(() => {
   *   engine.setAutoAdvancePaused(isModalOpen);
   * }, [isModalOpen]);
   */
  setAutoAdvancePaused(paused: boolean): void;
  debug?: {
    driverReady: boolean;
    assetsReady: boolean;
    sceneTrackTicks: number;
    viewport: { width: number; height: number };
  };
};

const DEFAULT_BLOCK_SIZE = 10;
const INPUT_CONTROLLER_WIDGET_ID = '__input_controller';

const makeInitialFrameState = (): EngineFrameState => ({
  tickIndex: -1,
  progress: 0,
  sceneId: '',
  sceneIndex: 0,
  sceneProgress: 0,
  tick: null,
});

export const useSceneEngine = (options: UseSceneEngineOptions): UseSceneEngineResult => {
  const scrollRegionRef = useRef<HTMLDivElement | null>(null);
  const variableStore = useMemo(() => new VariableStore(), []);
  const [frameState, setFrameState] = useState<EngineFrameState>(makeInitialFrameState);
  const [assetsReady, setAssetsReady] = useState(false);
  const [driverReady, setDriverReady] = useState(false);
  const [sceneTrack, setSceneTrack] = useState<SceneTrack | null>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [backgroundElement, setBackgroundElement] = useState<HTMLDivElement | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(1);

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

  // ─── Raw progress push (for ScrollCaptureSection) ────────────────────────────
  const rawProgressPushRef = useRef<number | null>(null);
  const [inputSource, setInputSource] = useState<'scroll' | 'push'>('scroll');

  const setRawProgress = useCallback((raw: number) => {
    rawProgressPushRef.current = Math.max(0, Math.min(1, raw));
    // Switch to push mode on first call (state update — triggers once)
    setInputSource((prev) => (prev === 'push' ? prev : 'push'));
  }, []);

  // ─── Auto-advance state ───────────────────────────────────────────────────────
  const autoAdvancePausedRef = useRef(false);

  // Scene index last seen by the auto-advance state machine. Used to detect scene
  // transitions so per-scene state can be reset when the engine moves to a new scene.
  const currentSceneIndexRef = useRef(-1);

  // True once the user has deliberately scrolled on the current scene. Set to false
  // whenever the engine transitions to a new scene. When true and pauseOnScroll is
  // enabled, auto-advance for the current scene is permanently disabled (no 200ms
  // debounce — it stays off for the entire remaining duration on this scene).
  const userScrolledCurrentSceneRef = useRef(false);

  // Internal progress tracker for auto-advance. Written every RAF tick during
  // auto-advance; null when auto-advance is idle. getGlobalProgress() reads this
  // first so the engine renders from the internal counter — no window.scrollTo
  // calls during auto-advance means no spurious scroll events to confuse pauseOnScroll.
  // When auto-advance stops or the user takes over, we sync window.scrollY once and clear.
  const autoAdvanceRawRef = useRef<number | null>(null);

  // One-shot flag: suppress the single scroll event generated by the sync window.scrollTo
  // when auto-advance hands off to scroll mode. Prevents it from spuriously triggering
  // the user-scroll handler.
  const suppressNextScrollRef = useRef(false);

  // Stable ref to scrollToRawProgress so handleUserScroll can call it without
  // a dependency on the useEngineInput result, which isn't available at definition time.
  const scrollToRawProgressRef = useRef<((raw: number) => void) | null>(null);

  const setAutoAdvancePaused = useCallback((paused: boolean) => {
    autoAdvancePausedRef.current = paused;
  }, []);

  const setCameraOverrideInternal = useCallback((next: CameraOverrideState | null) => {
    cameraOverrideRef.current = next;
    const scene = sceneRef.current;
    if (!scene) return;
    if (next) {
      scene.userData['__brewsite_camera_override'] = next;
    } else {
      delete (scene as unknown as { userData?: Record<string, unknown> })?.userData?.['__brewsite_camera_override'];
    }
  }, []);

  const blockSize = useMemo(
    () => Math.max(1, Math.round(options.framesPerTick ?? options.blockSize ?? DEFAULT_BLOCK_SIZE)),
    [options.framesPerTick, options.blockSize],
  );

  const sceneDefs = useMemo(
    (): SceneDefinition[] =>
      options.scenes.map((spec) => ({
        id: spec.sceneKey,
        getFrame: () => spec.element,
      })),
    [options.scenes],
  );

  const hasSceneInputController = frameState.tick
    ? ((frameState.tick.state.widgets[INPUT_CONTROLLER_WIDGET_ID] as SceneInputControllerSpec | undefined) ?? null) !== null
    : false;
  // controlledProgress forces direct mode — no scroll spacer, no window.scrollY.
  const inputMode: 'scroll' | 'direct' =
    (options.controlledProgress !== undefined || hasSceneInputController) ? 'direct' : 'scroll';

  const scrollRegionHeightPx = useMemo(() => {
    if (inputMode === 'direct') return Math.max(1, viewportHeight);
    const sceneCount = Math.max(1, options.scenes.length);
    const numTransitions = Math.max(0, sceneCount - 1);
    const totalFrames = numTransitions * blockSize + 1;
    if (options.pixelsPerScene !== undefined) {
      return Math.max(1, options.pixelsPerScene * sceneCount);
    }
    if (sceneCount <= 1) return Math.max(1, viewportHeight);
    return Math.max(1, viewportHeight + totalFrames);
  }, [inputMode, options.pixelsPerScene, options.scenes.length, blockSize, viewportHeight]);

  // wheelGuard: reads isWheelClaimedByInteraction from CameraWidget if registered.
  // This prevents scene navigation advancing while camera dolly is active.
  const wheelGuard = useCallback((): boolean => {
    const cameraWidget = options.widgetRegistry.get('camera') as { isWheelClaimedByInteraction?: () => boolean } | undefined;
    return cameraWidget?.isWheelClaimedByInteraction?.() ?? false;
  }, [options.widgetRegistry]);

  const resolveCurrentCameraTarget = useCallback((): [number, number, number] => {
    const override = cameraOverrideRef.current;
    if (override?.target) return override.target;

    const tick = driverRef.current?.getCurrentTick();
    const raw = tick?.state.widgets['camera'] as
      | { descriptor?: { mode?: string; target?: [number, number, number] } }
      | undefined;
    const desc = raw?.descriptor;
    if (desc?.mode === 'world' || desc?.mode === 'orbit') {
      if (Array.isArray(desc.target) && desc.target.length === 3) {
        return [desc.target[0], desc.target[1], desc.target[2]];
      }
    }
    return [0, 0, 0];
  }, []);

  const handleCameraOrbit = useCallback((cameraId: string, dx: number, dy: number, speed: number) => {
    if (cameraId !== 'camera') return;
    const camera = cameraRef.current;
    if (!camera) return;

    const target = resolveCurrentCameraTarget();
    const sourcePos = cameraOverrideRef.current?.position ?? [camera.position.x, camera.position.y, camera.position.z];
    const vx = sourcePos[0] - target[0];
    const vy = sourcePos[1] - target[1];
    const vz = sourcePos[2] - target[2];
    const radius = Math.max(0.001, Math.sqrt(vx * vx + vy * vy + vz * vz));
    const azimuth = Math.atan2(vx, vz);
    const polar = Math.asin(Math.max(-1, Math.min(1, vy / radius)));
    const w = Math.max(1, viewportRef.current.width);
    const h = Math.max(1, viewportRef.current.height);
    const nextAz = azimuth - (dx / w) * Math.PI * 2 * speed;
    const nextPol = Math.max(-1.4, Math.min(1.4, polar - (dy / h) * Math.PI * speed));
    const cosPol = Math.cos(nextPol);
    const next: CameraOverrideState = {
      enabled: true,
      target,
      position: [
        target[0] + radius * cosPol * Math.sin(nextAz),
        target[1] + radius * Math.sin(nextPol),
        target[2] + radius * cosPol * Math.cos(nextAz),
      ],
      up: [camera.up.x, camera.up.y, camera.up.z],
      fov: camera.fov,
      near: camera.near,
      far: camera.far,
    };
    setCameraOverrideInternal(next);
  }, [resolveCurrentCameraTarget, setCameraOverrideInternal]);

  const handleCameraDolly = useCallback((cameraId: string, delta: number, speed: number) => {
    if (cameraId !== 'camera') return;
    const camera = cameraRef.current;
    if (!camera) return;
    const target = resolveCurrentCameraTarget();
    const sourcePos = cameraOverrideRef.current?.position ?? [camera.position.x, camera.position.y, camera.position.z];
    const vx = sourcePos[0] - target[0];
    const vy = sourcePos[1] - target[1];
    const vz = sourcePos[2] - target[2];
    const radius = Math.max(0.001, Math.sqrt(vx * vx + vy * vy + vz * vz));
    const unit = [vx / radius, vy / radius, vz / radius] as const;
    const scale = 1 + (delta / 300) * speed;
    const nextRadius = Math.max(2, Math.min(2000, radius * scale));
    const next: CameraOverrideState = {
      enabled: true,
      target,
      position: [
        target[0] + unit[0] * nextRadius,
        target[1] + unit[1] * nextRadius,
        target[2] + unit[2] * nextRadius,
      ],
      up: [camera.up.x, camera.up.y, camera.up.z],
      fov: camera.fov,
      near: camera.near,
      far: camera.far,
    };
    setCameraOverrideInternal(next);
  }, [resolveCurrentCameraTarget, setCameraOverrideInternal]);

  const handleCameraReset = useCallback((_cameraId: string) => {
    setCameraOverrideInternal(null);
  }, [setCameraOverrideInternal]);

  const handleDiagramCanvasMove = useCallback((canvasId: string, dx: number, dy: number, speed: number) => {
    const widget = options.widgetRegistry.get(canvasId) as
      | { applyInputMove?: (dx: number, dy: number, dz?: number) => void }
      | undefined;
    widget?.applyInputMove?.(-dx, -dy, 0);
    if (widget?.applyInputMove && speed !== 1) {
      widget.applyInputMove(-dx * (speed - 1), -dy * (speed - 1), 0);
    }
  }, [options.widgetRegistry]);

  const handleDiagramCanvasRotate = useCallback((canvasId: string, dx: number, dy: number, speed: number) => {
    const widget = options.widgetRegistry.get(canvasId) as
      | { applyInputRotate?: (rx: number, ry: number, rz?: number) => void }
      | undefined;
    const scaledX = dx * 0.005 * speed;
    const scaledY = dy * 0.005 * speed;
    widget?.applyInputRotate?.(-scaledY, 0, -scaledX);
  }, [options.widgetRegistry]);

  const handleDiagramCanvasReset = useCallback((canvasId: string) => {
    const widget = options.widgetRegistry.get(canvasId) as
      | { resetInputTransform?: () => void }
      | undefined;
    widget?.resetInputTransform?.();
  }, [options.widgetRegistry]);

  const handleDiagramCanvasFocus = useCallback((
    canvasId: string,
    clientX: number,
    clientY: number,
    focusCenter?: [number, number] | [number, number, number],
  ) => {
    const widget = options.widgetRegistry.get(canvasId) as
      | { applyInputFocus?: (
        clientX: number,
        clientY: number,
        focusCenter?: [number, number] | [number, number, number],
      ) => void }
      | undefined;
    widget?.applyInputFocus?.(clientX, clientY, focusCenter);
  }, [options.widgetRegistry]);

  const inputControllerSpec = frameState.tick
    ? (frameState.tick.state.widgets[INPUT_CONTROLLER_WIDGET_ID] as SceneInputControllerSpec | undefined) ?? null
    : null;

  // ─── Progress mapper from ProgressManager profile ────────────────────────────
  const progressMapper = useMemo<SceneProgressMapper | null>(() => {
    if (!sceneTrack?.progressProfile || sceneTrack.progressProfile.isUniform) {
      return null; // identity — no mapper needed
    }
    return new SceneProgressMapper(sceneTrack.progressProfile);
  }, [sceneTrack]);

  const handleUserScroll = useCallback(() => {
    if (suppressNextScrollRef.current) {
      // This is the scroll event fired by our own sync window.scrollTo call.
      // By now rawProgressRef (inside useEngineScroll) has been updated to the
      // synced position — it is now safe to clear the internal tracker and let
      // getGlobalProgress() fall through to the scroll-derived path.
      suppressNextScrollRef.current = false;
      autoAdvanceRawRef.current = null;
      return;
    }
    // Mark that the user has deliberately scrolled on the current scene.
    // Permanently disables auto-advance for this scene until the next scene transition.
    userScrolledCurrentSceneRef.current = true;
    // If auto-advance was active, sync window.scrollY to the auto-advance position.
    // IMPORTANT: do NOT clear autoAdvanceRawRef here. We leave it set so that
    // getGlobalProgress() keeps returning the correct position while window.scrollTo
    // is in-flight (asynchronous). The ref is cleared in the suppress path above,
    // once the sync scroll event fires and rawProgressRef has caught up.
    // Clearing it here would cause getGlobalProgress() to fall through to the stale
    // rawProgressRef value (user's old scroll position), snapping the animation back.
    const aa = autoAdvanceRawRef.current;
    if (aa !== null) {
      suppressNextScrollRef.current = true;
      scrollToRawProgressRef.current?.(aa);
    }
  }, []); // stable: all state accessed via mutable refs

  const {
    progress: inputProgress,
    scrollToProgress: inputScrollToProgress,
    getGlobalProgress: inputGetGlobalProgress,
    getRawProgress,
    scrollToRawProgress,
  } = useEngineInput({
    scrollRegionRef,
    scrollRegionHeightPx,
    sceneCount: options.scenes.length,
    canvasRef: canvasElementRef,
    inputMap: options.inputMap,
    wheelGuard,
    inputControllerSpec,
    controlledProgress: options.controlledProgress,
    onControlledProgressChange: options.onControlledProgressChange,
    progressMapper,
    onCameraOrbit: handleCameraOrbit,
    onCameraDolly: handleCameraDolly,
    onCameraReset: handleCameraReset,
    onDiagramCanvasMove: handleDiagramCanvasMove,
    onDiagramCanvasRotate: handleDiagramCanvasRotate,
    onDiagramCanvasReset: handleDiagramCanvasReset,
    onDiagramCanvasFocus: handleDiagramCanvasFocus,
    onUserScroll: handleUserScroll,
  });

  // Keep the ref current so handleUserScroll (defined before useEngineInput) can
  // call scrollToRawProgress for the one-time sync on auto-advance handoff.
  // Ref assignment is safe here: runs on every render, never triggers a re-render.
  scrollToRawProgressRef.current = scrollToRawProgress;

  // ─── getGlobalProgress: auto-advance internal ref takes highest priority ─────
  // Priority: autoAdvanceRawRef (auto-advance active) → rawProgressPushRef
  // (ScrollCaptureSection push mode) → scroll-derived position.
  // autoAdvanceRawRef is a plain ref so reads inside render are always current
  // without needing useState — frameState changes trigger re-renders at ~60fps
  // which keeps the reported progress in sync with what the engine is rendering.
  const getGlobalProgress = useCallback((): number => {
    const aa = autoAdvanceRawRef.current;
    if (aa !== null) {
      return progressMapper ? progressMapper.remap(aa) : aa;
    }
    if (rawProgressPushRef.current !== null) {
      const raw = rawProgressPushRef.current;
      return progressMapper ? progressMapper.remap(raw) : raw;
    }
    return inputGetGlobalProgress();
  }, [inputGetGlobalProgress, progressMapper]);

  // progress exposed to React consumers: read autoAdvanceRawRef during render
  // (re-renders are driven by frameState changes ~60fps so this stays current).
  const autoAdvanceRawSnapshot = autoAdvanceRawRef.current;
  const progress = autoAdvanceRawSnapshot !== null
    ? (progressMapper ? progressMapper.remap(autoAdvanceRawSnapshot) : autoAdvanceRawSnapshot)
    : inputSource === 'push' && rawProgressPushRef.current !== null
      ? (progressMapper ? progressMapper.remap(rawProgressPushRef.current) : rawProgressPushRef.current)
      : inputProgress;

  const scrollToProgress = inputScrollToProgress;

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

  const setCanvasRef = useCallback((next: HTMLCanvasElement | null) => {
    setCanvas(next);
    canvasElementRef.current = next;
  }, []);

  const setBackgroundRef = useCallback((next: HTMLDivElement | null) => {
    setBackgroundElement(next);
  }, []);

  const setViewportSize = useCallback((width: number, height: number) => {
    viewportRef.current = { width, height };
    setViewportHeight(height);
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (renderer) renderer.setSize(width, height, false);
    if (camera) {
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    }
  }, []);

  const setCameraOverride = setCameraOverrideInternal;

  const getCameraOverride = useCallback(() => cameraOverrideRef.current, []);

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
    if (sceneRef.current) {
      sceneRef.current.userData['__brewsite_renderer'] = renderer;
    }
    const onContextLost = (event: Event) => {
      event.preventDefault();
    };
    const onContextRestored = () => {};
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
      if (sceneRef.current) {
        delete (sceneRef.current as unknown as { userData?: Record<string, unknown> })?.userData?.['__brewsite_renderer'];
      }
    };
  }, [canvas]);

  useEffect(() => {
    const backgroundWidget = options.widgetRegistry.get('background');
    const backgroundWithDom = backgroundWidget as unknown as { setDomElement?: (el: HTMLElement | null) => void } | undefined;
    if (!backgroundWithDom || typeof backgroundWithDom.setDomElement !== 'function') {
      return;
    }
    backgroundWithDom.setDomElement(backgroundElement);
  }, [backgroundElement, options.widgetRegistry]);

  useEffect(() => {
    if (typeof window === 'undefined' || !canvas) return;
    readyRef.current = false;
    setDriverReady(false);
    setAssetsReady(false);
    setFrameState(makeInitialFrameState());
    if (!sceneTrack) return;

    const scene = new THREE.Scene();
    const initialViewport = viewportRef.current;
    const initialAspect = initialViewport.width / Math.max(1, initialViewport.height);
    const camera = new THREE.PerspectiveCamera(45, initialAspect, 0.1, 2000);
    camera.position.set(0, 0, 100);
    camera.updateProjectionMatrix();
    scene.userData['__brewsite_camera'] = camera;
    scene.userData['__brewsite_renderer'] = rendererRef.current;
    if (cameraOverrideRef.current) {
      scene.userData['__brewsite_camera_override'] = cameraOverrideRef.current;
    }
    sceneRef.current = scene;
    cameraRef.current = camera;

    const driver = new RuntimeDriverImpl({
      widgetRegistry: options.widgetRegistry,
      variableStore,
      manifest: options.manifest ?? null,
      onAssetsReady: () => setAssetsReady(true),
      onError: options.onError,
      onWidgetError: options.onWidgetError,
    });
    driverRef.current = driver;

    let disposed = false;
    driver.initialize(scene, rendererRef.current ?? undefined)
      .then(() => {
        if (disposed) return;
        setDriverReady(true);
      })
      .catch((error) => {
        if (disposed) return;
        const err = error instanceof Error ? error : new Error(String(error));
        options.onError?.(err);
      });

    return () => {
      disposed = true;
      driver.dispose();
      driverRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      delete (scene as unknown as { userData?: Record<string, unknown> })?.userData?.['__brewsite_camera'];
      delete (scene as unknown as { userData?: Record<string, unknown> })?.userData?.['__brewsite_renderer'];
      delete (scene as unknown as { userData?: Record<string, unknown> })?.userData?.['__brewsite_camera_override'];
      loopRef.current?.stop();
      loopRef.current = null;
      frameDriverRef.current?.reset();
    };
  }, [canvas, options.widgetRegistry, options.onError, options.manifest, variableStore, sceneTrack]);

  useEffect(() => {
    if (options.manifest === null) {
      setSceneTrack(null);
      return;
    }
    const key = buildSceneTrackKey({
      scenes: options.scenes,
      widgetRegistry: options.widgetRegistry,
      blockSize,
      prefersReducedMotion,
    });
    const cached = getCachedTrack(key);
    if (cached) {
      setSceneTrack(cached);
      return;
    }
    const compiled = compileSceneTrack({
      scenes: sceneDefs,
      widgetRegistry: options.widgetRegistry,
      blockSize,
      prefersReducedMotion,
    });
    if (compiled.warnings?.length && options.onCompileWarning) {
      options.onCompileWarning(compiled.warnings);
    }
    setCachedTrack(key, compiled);
    setSceneTrack(compiled);
  }, [
    options.scenes,
    options.widgetRegistry,
    options.manifest,
    blockSize,
    prefersReducedMotion,
    sceneDefs,
    options.onCompileWarning,
  ]);

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
        renderer.render(scene, camera);
      },
      onAfterTick: ({ deltaSeconds }) => {
        frameDriver.handleTick(driver.getCurrentTick());

        // ── Auto-advance state machine ──────────────────────────────────────
        // Skip if paused externally or no progress profile available.
        if (autoAdvancePausedRef.current) return;
        const profile = sceneTrack?.progressProfile;
        if (!profile) return;

        const currentTick = driver.getCurrentTick();
        if (!currentTick) return;

        // ── Scene transition detection ──────────────────────────────────────
        // When the engine moves to a new scene, reset per-scene auto-advance state:
        //   • userScrolledCurrentSceneRef → false  (user hasn't scrolled this scene yet)
        //   • autoAdvanceRawRef           → null   (fresh start for the new scene)
        // This is how pauseOnScroll "resets" between scenes — not on a timer,
        // but on the structural event of entering a new scene.
        if (currentTick.sceneIndex !== currentSceneIndexRef.current) {
          currentSceneIndexRef.current = currentTick.sceneIndex;
          userScrolledCurrentSceneRef.current = false;
          autoAdvanceRawRef.current = null;
        }

        const segment = profile.segments[currentTick.sceneIndex];
        if (!segment?.autoAdvance) return;

        const { rawRate, maxRaw, pauseOnScroll } = segment.autoAdvance;

        // pauseOnScroll semantics: once the user scrolls on this scene, auto-advance
        // is permanently off for this scene. No debounce — it does not resume after
        // a timeout. It only re-enables when currentSceneIndexRef changes (above).
        if (pauseOnScroll && userScrolledCurrentSceneRef.current) return;

        // Seed from internal tracker if already advancing; otherwise from the
        // current scroll position so we start from where the user left off.
        const currentRaw = autoAdvanceRawRef.current ?? getRawProgress();

        if (currentRaw >= maxRaw) {
          // Auto-advance reached its ceiling. Sync window.scrollY once so that
          // subsequent user scrolling continues from the right position, then stop.
          if (autoAdvanceRawRef.current !== null) {
            autoAdvanceRawRef.current = null;
            suppressNextScrollRef.current = true;
            scrollToRawProgressRef.current?.(maxRaw);
          }
          return;
        }

        const deltaRaw = deltaSeconds * rawRate;
        const nextRaw = Math.min(currentRaw + deltaRaw, maxRaw);
        // Write to internal ref. No window.scrollTo → no scroll events generated →
        // no race condition with pauseOnScroll detection.
        autoAdvanceRawRef.current = nextRaw;
      },
      fpsCap: options.fpsCap,
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
  // getRawProgress is a stable useCallback from useEngineScroll; include for correctness.
  }, [sceneTrack, getGlobalProgress, options.fpsCap, options.onReady, driverReady, getRawProgress]);

  return {
    frameState,
    scrollRegionRef,
    scrollRegionHeightPx,
    inputMode,
    inputSource,
    progress,
    scrollToProgress,
    getGlobalProgress,
    setRawProgress,
    sceneCount: options.scenes.length,
    sceneIds: options.scenes.map((s) => s.sceneKey),
    sceneOverlays: sceneTrack?.sceneOverlays ?? new Map(),
    variableStore,
    setCanvasRef,
    setBackgroundRef,
    setViewportSize,
    getCamera: () => cameraRef.current,
    getRenderer: () => rendererRef.current,
    setCameraOverride,
    getCameraOverride,
    setAutoAdvancePaused,
    debug: {
      driverReady,
      assetsReady,
      sceneTrackTicks: sceneTrack?.ticks?.length ?? 0,
      viewport: { ...viewportRef.current },
    },
  };
};
