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
import { isCameraActionTarget } from '../widget/WidgetRegistry';
import { EngineFrameDriver } from './EngineFrameDriver';
import type {
  CameraInteractionDefaults,
  EngineFrameState,
  EngineTimingProfile,
  InputModePolicy,
  InternalSceneSpec,
  ScrollSource,
} from './engineTypes';
import { useEngineInput } from './useEngineInput';
import type { AssetManifest } from '../widget/types';
import type { SceneNavInputMap } from '../input/types';
import type { CameraOverrideState } from '../elements/camera/types';
import type { CameraWidget } from '../elements/camera/CameraWidget';
import type { SceneInputControllerSpec } from '../input/types';
import { SceneProgressMapper } from './SceneProgressMapper';

export type UseSceneEngineOptions = {
  scenes: InternalSceneSpec[];
  widgetRegistry: WidgetRegistry;
  manifest?: AssetManifest | null;
  timingProfile?: EngineTimingProfile;
  qualityPreset?: 'performance' | 'balanced' | 'high';
  fpsCap?: number;
  pixelsPerScene?: number;
  pixelsPerScrollUnit?: number;
  scrollHeightMode?: 'scene-count' | 'scroll-units';
  scrollSource?: ScrollSource;
  inputModePolicy?: InputModePolicy;
  primaryCameraId?: string;
  primaryCanvasActionTargetId?: string;
  enableKeyboardInControlledMode?: boolean;
  controlledInputMap?: SceneNavInputMap;
  maxAnimBoostPerFrame?: number;
  cameraInteractionDefaults?: CameraInteractionDefaults;
  invalidateCacheToken?: number | string;
  /**
   * Exact scroll region height in pixels. When set, overrides all automatic
   * scroll-height calculations (`pixelsPerScene`, viewport-based defaults).
   *
   * Use this when the page has a precomputed offset system (e.g. a sidebar with
   * `SCENE_SCROLL_OFFSETS` in absolute pixels) that must align with `window.scrollY`.
   * The total height should equal the sum of all per-scene pixel budgets.
   */
  scrollHeightPx?: number;
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
const QUALITY_PRESET_BLOCK_SIZE: Record<NonNullable<EngineTimingProfile['qualityPreset']>, number> = {
  performance: 30,
  balanced: 60,
  high: 120,
} as const;
const INPUT_CONTROLLER_WIDGET_ID = '__input_controller';
const DEFAULT_CAMERA_INTERACTION_DEFAULTS = {
  wheelLockIdleMs: 180,
  wheelAxisDominance: 1.2,
  wheelAxisActivationThreshold: 10,
  orbitPolarMin: -1.4,
  orbitPolarMax: 1.4,
  dollyRadiusMin: 2,
  dollyRadiusMax: 2000,
} as const satisfies Required<CameraInteractionDefaults>;

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

  // Stable refs to useEngineInput functions so handleUserScroll (defined before
  // useEngineInput is called) can access them without stale-closure issues.
  // Both are populated immediately after the useEngineInput call below.
  const forceRawProgressRef = useRef<((raw: number) => void) | null>(null);
  const scrollToRawProgressRef = useRef<((raw: number) => void) | null>(null);
  const warnedMissingScrollUnitsRef = useRef(false);
  const warnedCameraTargetsRef = useRef(new Set<string>());

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

  const blockSize = useMemo(() => {
    const qualityPreset = options.timingProfile?.qualityPreset ?? options.qualityPreset;
    const qualityBlockSize = qualityPreset ? QUALITY_PRESET_BLOCK_SIZE[qualityPreset] : undefined;
    const resolved = options.timingProfile?.blockSize
      ?? options.framesPerTick
      ?? options.blockSize
      ?? qualityBlockSize
      ?? DEFAULT_BLOCK_SIZE;
    return Math.max(1, Math.round(resolved));
  }, [options.timingProfile, options.qualityPreset, options.framesPerTick, options.blockSize]);

  const resolvedFpsCap = options.timingProfile?.fpsCap ?? options.fpsCap;

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
  const inputModePolicy = options.inputModePolicy ?? 'auto';
  const primaryCameraId = options.primaryCameraId ?? 'camera';
  const primaryCanvasActionTargetId = options.primaryCanvasActionTargetId ?? 'llm-canvas';
  const scrollHeightMode = options.scrollHeightMode ?? 'scene-count';
  const cameraInteractionDefaults = useMemo<Required<CameraInteractionDefaults>>(() => ({
    wheelLockIdleMs: options.cameraInteractionDefaults?.wheelLockIdleMs ?? DEFAULT_CAMERA_INTERACTION_DEFAULTS.wheelLockIdleMs,
    wheelAxisDominance:
      options.cameraInteractionDefaults?.wheelAxisDominance ?? DEFAULT_CAMERA_INTERACTION_DEFAULTS.wheelAxisDominance,
    wheelAxisActivationThreshold:
      options.cameraInteractionDefaults?.wheelAxisActivationThreshold
      ?? DEFAULT_CAMERA_INTERACTION_DEFAULTS.wheelAxisActivationThreshold,
    orbitPolarMin: options.cameraInteractionDefaults?.orbitPolarMin ?? DEFAULT_CAMERA_INTERACTION_DEFAULTS.orbitPolarMin,
    orbitPolarMax: options.cameraInteractionDefaults?.orbitPolarMax ?? DEFAULT_CAMERA_INTERACTION_DEFAULTS.orbitPolarMax,
    dollyRadiusMin: options.cameraInteractionDefaults?.dollyRadiusMin ?? DEFAULT_CAMERA_INTERACTION_DEFAULTS.dollyRadiusMin,
    dollyRadiusMax: options.cameraInteractionDefaults?.dollyRadiusMax ?? DEFAULT_CAMERA_INTERACTION_DEFAULTS.dollyRadiusMax,
  }), [options.cameraInteractionDefaults]);

  const inputMode: 'scroll' | 'direct' = useMemo(() => {
    if (options.controlledProgress !== undefined) return 'direct';
    if (inputModePolicy === 'prefer-scroll') return 'scroll';
    if (inputModePolicy === 'prefer-direct') {
      return hasSceneInputController ? 'direct' : 'scroll';
    }
    return hasSceneInputController ? 'direct' : 'scroll';
  }, [options.controlledProgress, inputModePolicy, hasSceneInputController]);

  const scrollRegionHeightPx = useMemo(() => {
    if (inputMode === 'direct') return Math.max(1, viewportHeight);
    // Explicit override — takes priority over all automatic formulas.
    // Use this when the scroll region must match an externally-managed offset system
    // (e.g. a docs nav with precomputed per-scene pixel offsets).
    if (options.scrollHeightPx !== undefined) {
      return Math.max(1, options.scrollHeightPx);
    }
    const sceneCount = Math.max(1, options.scenes.length);
    const numTransitions = Math.max(0, sceneCount - 1);
    const totalFrames = numTransitions * blockSize + 1;
    const sceneCountHeight = options.pixelsPerScene !== undefined
      ? Math.max(1, options.pixelsPerScene * sceneCount)
      : sceneCount <= 1
        ? Math.max(1, viewportHeight)
        : Math.max(1, viewportHeight + totalFrames);

    if (scrollHeightMode === 'scroll-units') {
      const totalUnits = sceneTrack?.progressProfile?.totalScrollUnits;
      if (typeof totalUnits === 'number' && Number.isFinite(totalUnits) && totalUnits > 0) {
        const pixelsPerUnit = options.pixelsPerScrollUnit ?? 1;
        return Math.max(1, totalUnits * pixelsPerUnit);
      }
      return sceneCountHeight;
    }

    if (options.pixelsPerScene !== undefined) {
      return Math.max(1, options.pixelsPerScene * sceneCount);
    }
    if (sceneCount <= 1) return Math.max(1, viewportHeight);
    return Math.max(1, viewportHeight + totalFrames);
  }, [
    inputMode,
    options.scrollHeightPx,
    options.pixelsPerScene,
    options.pixelsPerScrollUnit,
    options.scenes.length,
    blockSize,
    viewportHeight,
    scrollHeightMode,
    sceneTrack,
  ]);

  useEffect(() => {
    if (inputMode !== 'scroll') return;
    if (options.scrollHeightPx !== undefined) return;
    if (scrollHeightMode !== 'scroll-units') return;
    if (!sceneTrack) return;
    if (sceneTrack?.progressProfile?.totalScrollUnits !== undefined) return;
    if (warnedMissingScrollUnitsRef.current) return;
    warnedMissingScrollUnitsRef.current = true;
    console.warn(
      '[useSceneEngine] scrollHeightMode="scroll-units" requested but scene track has no progressProfile.totalScrollUnits. ' +
      'Falling back to scene-count scroll height. Define <ProgressManager> or switch scrollHeightMode.',
    );
  }, [inputMode, options.scrollHeightPx, scrollHeightMode, sceneTrack]);

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

  const warnInvalidCameraTarget = useCallback((cameraId: string) => {
    if (warnedCameraTargetsRef.current.has(cameraId)) return;
    warnedCameraTargetsRef.current.add(cameraId);
    console.warn(
      `[useSceneEngine] Action camera target "${cameraId}" is missing or does not implement ICameraActionTarget. ` +
      'Register a widget implementing applyOrbit/applyDolly/applyReset, or use the configured primaryCameraId.',
    );
  }, []);

  const handleCameraOrbit = useCallback((cameraId: string, dx: number, dy: number, speed: number) => {
    if (cameraId !== primaryCameraId) {
      const target = options.widgetRegistry.get(cameraId);
      if (!target || !isCameraActionTarget(target)) {
        warnInvalidCameraTarget(cameraId);
        return;
      }
      target.applyOrbit(dx, dy, speed);
      return;
    }
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
    const nextPol = Math.max(
      cameraInteractionDefaults.orbitPolarMin,
      Math.min(cameraInteractionDefaults.orbitPolarMax, polar - (dy / h) * Math.PI * speed),
    );
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
  }, [
    primaryCameraId,
    options.widgetRegistry,
    warnInvalidCameraTarget,
    resolveCurrentCameraTarget,
    cameraInteractionDefaults.orbitPolarMin,
    cameraInteractionDefaults.orbitPolarMax,
    setCameraOverrideInternal,
  ]);

  const handleCameraDolly = useCallback((cameraId: string, delta: number, speed: number) => {
    if (cameraId !== primaryCameraId) {
      const targetWidget = options.widgetRegistry.get(cameraId);
      if (!targetWidget || !isCameraActionTarget(targetWidget)) {
        warnInvalidCameraTarget(cameraId);
        return;
      }
      targetWidget.applyDolly(delta, speed);
      return;
    }
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
    const nextRadius = Math.max(
      cameraInteractionDefaults.dollyRadiusMin,
      Math.min(cameraInteractionDefaults.dollyRadiusMax, radius * scale),
    );
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
  }, [
    primaryCameraId,
    options.widgetRegistry,
    warnInvalidCameraTarget,
    resolveCurrentCameraTarget,
    cameraInteractionDefaults.dollyRadiusMin,
    cameraInteractionDefaults.dollyRadiusMax,
    setCameraOverrideInternal,
  ]);

  const handleCameraReset = useCallback((cameraId: string) => {
    if (cameraId !== primaryCameraId) {
      const targetWidget = options.widgetRegistry.get(cameraId);
      if (!targetWidget || !isCameraActionTarget(targetWidget)) {
        warnInvalidCameraTarget(cameraId);
        return;
      }
      targetWidget.applyReset();
      return;
    }
    setCameraOverrideInternal(null);
  }, [primaryCameraId, options.widgetRegistry, warnInvalidCameraTarget, setCameraOverrideInternal]);

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
    // Mark that the user has deliberately scrolled on the current scene.
    // Permanently disables auto-advance for this scene until the next scene transition.
    userScrolledCurrentSceneRef.current = true;
    // If auto-advance was active, sync rawProgressRef to the auto-advance position
    // before clearing autoAdvanceRawRef. This ensures getGlobalProgress() returns
    // the correct position immediately after the clear — no one-frame snap.
    //
    // forceRawProgress() writes directly to rawProgressRef/progressRef in
    // useEngineScroll without calling window.scrollTo, so no scroll event is
    // generated and no suppress mechanism is needed. This approach works
    // correctly in both real browsers and jsdom (where window.scrollTo is a
    // no-op and does not fire a scroll event).
    //
    // NOTE: update() in useEngineScroll has already run before this callback
    // fires (the scroll handler calls update() first, then onUserScroll()).
    // So rawProgressRef.current already reflects the user's actual scroll
    // position. We only override it if auto-advance was in control — in that
    // case, the user hasn't actually scrolled to a meaningful position yet,
    // and we seed rawProgressRef with the auto-advance position so the
    // animation continues smoothly from where auto-advance left off.
    const aa = autoAdvanceRawRef.current;
    if (aa !== null) {
      // 1. Immediately seed rawProgressRef with the auto-advance position so
      //    getGlobalProgress() is correct on THIS event — no one-frame snap.
      forceRawProgressRef.current?.(aa);
      // 2. Clear the ref BEFORE calling scrollToRawProgress to prevent any
      //    re-entrancy if a scroll event fires synchronously (single-threaded JS
      //    means this cannot happen, but the ordering makes the intent explicit).
      autoAdvanceRawRef.current = null;
      // 3. Sync window.scrollY to the auto-advance position. In real browsers,
      //    scrollTo() updates scrollY synchronously so that the user's subsequent
      //    scroll events compute progress from the correct base (aa), not from
      //    wherever scrollY was before auto-advance started (typically 0).
      //    Without this call, the SECOND user scroll event recomputes rawProgressRef
      //    from the stale scrollY≈0 and the animation snaps back to near frame 0.
      //    In jsdom scrollTo is a no-op — forceRawProgress above handles that case.
      scrollToRawProgressRef.current?.(aa);
    }
  }, []); // stable: all state accessed via mutable refs

  const {
    progress: inputProgress,
    scrollToProgress: inputScrollToProgress,
    getGlobalProgress: inputGetGlobalProgress,
    getRawProgress,
    scrollToRawProgress,
    forceRawProgress,
  } = useEngineInput({
    scrollRegionRef,
    scrollRegionHeightPx,
    scrollSource: options.scrollSource,
    sceneCount: options.scenes.length,
    inputMode,
    canvasRef: canvasElementRef,
    inputMap: options.inputMap,
    wheelGuard,
    inputControllerSpec,
    controlledProgress: options.controlledProgress,
    onControlledProgressChange: options.onControlledProgressChange,
    enableKeyboardInControlledMode: options.enableKeyboardInControlledMode,
    controlledInputMap: options.controlledInputMap,
    progressMapper,
    idDefaults: {
      cameraId: primaryCameraId,
      canvasId: primaryCanvasActionTargetId,
    },
    actionWheelLockIdleMs: cameraInteractionDefaults.wheelLockIdleMs,
    onCameraOrbit: handleCameraOrbit,
    onCameraDolly: handleCameraDolly,
    onCameraReset: handleCameraReset,
    onDiagramCanvasMove: handleDiagramCanvasMove,
    onDiagramCanvasRotate: handleDiagramCanvasRotate,
    onDiagramCanvasReset: handleDiagramCanvasReset,
    onDiagramCanvasFocus: handleDiagramCanvasFocus,
    onUserScroll: handleUserScroll,
  });

  // Keep refs current so handleUserScroll (defined before useEngineInput) can
  // access the latest stable functions from useEngineInput/useEngineScroll.
  // Ref assignment is safe here: runs on every render, never triggers a re-render.
  scrollToRawProgressRef.current = scrollToRawProgress;
  forceRawProgressRef.current = forceRawProgress;

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
    const cameraWidget = options.widgetRegistry.get('camera') as (CameraWidget & {
      setInteractionDefaults?: (defaults: CameraInteractionDefaults | null) => void;
    }) | undefined;
    cameraWidget?.setInteractionDefaults?.(cameraInteractionDefaults);
  }, [options.widgetRegistry, cameraInteractionDefaults]);

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
      maxAnimBoostPerFrame: options.maxAnimBoostPerFrame,
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
  }, [
    canvas,
    options.widgetRegistry,
    options.onError,
    options.manifest,
    options.maxAnimBoostPerFrame,
    variableStore,
    sceneTrack,
  ]);

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
      invalidateCacheToken: options.invalidateCacheToken,
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
    options.invalidateCacheToken,
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
        //
        // IMPORTANT: When auto-advance is active with a non-linear fn (e.g. dwellFn),
        // the pacing curve can saturate at 1.0 well before rawEnd, pushing engine
        // progress into the next block while aa is still within the current segment.
        // Treating that early engine-sceneIndex jump as a real scene transition resets
        // autoAdvanceRawRef → engine snaps back to scroll progress (≈0) → sceneIndex
        // returns to 0 → auto-advance restarts from the beginning → infinite loop.
        //
        // Guard: a transition is spurious when auto-advance is active (aa !== null)
        // AND aa is still before the current segment's rawEnd — fn compression caused
        // the engine to display the next scene, but the raw position hasn't crossed over.
        if (currentTick.sceneIndex !== currentSceneIndexRef.current) {
          const aaForCheck = autoAdvanceRawRef.current;
          const currentSeg = profile.segments[currentSceneIndexRef.current];
          const isSpuriousTransition =
            aaForCheck !== null && currentSeg !== undefined && aaForCheck < currentSeg.rawEnd;
          if (!isSpuriousTransition) {
            currentSceneIndexRef.current = currentTick.sceneIndex;
            userScrolledCurrentSceneRef.current = false;
            autoAdvanceRawRef.current = null;
          }
        }

        // Find the segment that owns the current raw position.
        // When auto-advance is active we look up by raw space — not by
        // currentTick.sceneIndex — because fn compression can place the engine's
        // displayed sceneIndex ahead of aa, pointing at a segment (or past all
        // segments) that doesn't match the auto-advance's actual position.
        const activeAa = autoAdvanceRawRef.current;
        const currentRaw = activeAa ?? getRawProgress();
        let segment = profile.segments[currentTick.sceneIndex];
        if (activeAa !== null) {
          for (let si = 0; si < profile.segments.length; si++) {
            const s = profile.segments[si]!;
            if (currentRaw >= s.rawStart && (currentRaw < s.rawEnd || si === profile.segments.length - 1)) {
              segment = s;
              break;
            }
          }
        }
        if (!segment?.autoAdvance) return;

        const { rawRate, maxRaw, pauseOnScroll } = segment.autoAdvance;

        // pauseOnScroll semantics: once the user scrolls on this scene, auto-advance
        // is permanently off for this scene. No debounce — it does not resume after
        // a timeout. It only re-enables when currentSceneIndexRef changes (above).
        if (pauseOnScroll && userScrolledCurrentSceneRef.current) return;

        if (currentRaw >= maxRaw) {
          // Auto-advance reached its ceiling. Sync rawProgressRef to maxRaw so
          // subsequent user scrolling continues from the correct position, then stop.
          //
          // We use forceRawProgress() to write maxRaw directly into rawProgressRef
          // (inside useEngineScroll) without calling window.scrollTo. This avoids
          // the old suppress-scroll-event pattern which was unreliable in jsdom
          // (window.scrollTo is a no-op, fires no scroll event) and in real
          // browsers when already at the target position. After forceRawProgress()
          // writes the value, it is safe to clear autoAdvanceRawRef immediately —
          // getGlobalProgress() will fall through to rawProgressRef (now = maxRaw),
          // not the stale pre-advance value that caused the snap to frame 0.
          if (activeAa !== null) {
            forceRawProgressRef.current?.(maxRaw);
            autoAdvanceRawRef.current = null;
          }
          return;
        }

        const deltaRaw = deltaSeconds * rawRate;
        const nextRaw = Math.min(currentRaw + deltaRaw, maxRaw);
        // Write to internal ref. No window.scrollTo → no scroll events generated →
        // no race condition with pauseOnScroll detection.
        autoAdvanceRawRef.current = nextRaw;
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
  // getRawProgress is a stable useCallback from useEngineScroll; include for correctness.
  }, [sceneTrack, getGlobalProgress, resolvedFpsCap, options.onReady, driverReady, getRawProgress]);

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
