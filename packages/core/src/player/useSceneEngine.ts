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

const DEFAULT_PIXELS_PER_SCENE = 800;
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
  const lastUserScrollTimeRef = useRef(0);

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
    lastUserScrollTimeRef.current = Date.now();
  }, []);

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

  // ─── Wrap getGlobalProgress to check push override ───────────────────────────
  // When ScrollCaptureSection is providing raw progress, bypass the scroll-derived value.
  const getGlobalProgress = useCallback((): number => {
    if (rawProgressPushRef.current !== null) {
      const raw = rawProgressPushRef.current;
      return progressMapper ? progressMapper.remap(raw) : raw;
    }
    return inputGetGlobalProgress();
  }, [inputGetGlobalProgress, progressMapper]);

  const progress = inputSource === 'push' && rawProgressPushRef.current !== null
    ? (progressMapper ? progressMapper.remap(rawProgressPushRef.current) : rawProgressPushRef.current)
    : inputProgress;

  const scrollToProgress = inputScrollToProgress;

  // ─── Auto-advance: advance raw progress by input-mode-appropriate method ─────
  const advanceToRawProgress = useCallback((raw: number) => {
    if (inputSource === 'push') {
      setRawProgress(raw);
    } else {
      scrollToRawProgress(raw);
    }
  }, [inputSource, setRawProgress, scrollToRawProgress]);

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

        const segment = profile.segments[currentTick.sceneIndex];
        if (!segment?.autoAdvance) return;

        const { rawRate, maxRaw, pauseOnScroll } = segment.autoAdvance;

        // Check pauseOnScroll: bail if user scrolled recently (within 200ms).
        if (pauseOnScroll && Date.now() - lastUserScrollTimeRef.current < 200) return;

        const currentRaw = getRawProgress();
        if (currentRaw >= maxRaw) return;

        const deltaRaw = deltaSeconds * rawRate;
        const nextRaw = Math.min(currentRaw + deltaRaw, maxRaw);
        advanceToRawProgress(nextRaw);
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
  // advanceToRawProgress and getRawProgress are stable callbacks; include them
  // for correctness but they don't change identity meaningfully.
  }, [sceneTrack, getGlobalProgress, options.fpsCap, options.onReady, driverReady, getRawProgress, advanceToRawProgress]);

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
