// CameraWidget — ISceneElement + IAnimationController.
// Manages both scene-driven and interactive camera modes.

import type {
  SceneCamera,
  Vec3,
  CameraOverrideState,
  ICameraInteractionDriver,
  CameraInteractionDriverFactory,
} from './types';
import type * as THREE from 'three';
import { DEFAULT_CAMERA, functionalCameraTransitionSpec, extractWorldPosFromDescriptor } from './compile';
import { Camera } from './dsl';
import type { CameraProps } from './dsl';
import { applyCamera, CameraControlsDriver } from './render';
import type { AnimationTickContext, IAnimationController, ISceneElement } from '../../widget/types';
import { CUSTOM_NODE_HANDLER } from '../../widget/WidgetRegistry';
import type { SceneTrackTick } from '../../compiler/sceneTrackTypes';
/** Minimal model state shape used for camera target resolution. Full type lives in @brewsite/model. */
type ModelStateForCamera = { model?: { position?: [number, number, number] } };

const CAMERA_KEY = '__brewsite_camera';
const RENDERER_KEY = '__brewsite_renderer';
const CAMERA_OVERRIDE_KEY = '__brewsite_camera_override';
const CAMERA_FOCUS_KEY = '__brewsite_camera_focus';

const defaultDriverFactory: CameraInteractionDriverFactory = (cameraObject, domElement, config) => {
  const driver = new CameraControlsDriver();
  driver.attach(cameraObject, domElement, config);
  return driver;
};

export { CUSTOM_NODE_HANDLER };

export class CameraWidget implements ISceneElement<SceneCamera>, IAnimationController {
  readonly widgetId = 'camera';
  readonly defaultState: SceneCamera = DEFAULT_CAMERA;
  readonly transitionSpec = functionalCameraTransitionSpec;
  readonly DslComponent = Camera;
  readonly useDefaultStateWhenAbsent = false;

  constructor(
    /**
     * Factory that creates an ICameraInteractionDriver, attaches it, and returns it.
     * Defaults to creating a CameraControlsDriver (production implementation).
     * Inject a FakeInteractionDriver factory in tests.
     */
    private readonly driverFactory: CameraInteractionDriverFactory = defaultDriverFactory,
  ) {}

  // ─── Renderer / DOM references (lazy-init from scene.userData) ──────────
  private domElement: HTMLElement | null = null;
  private rendererRef: THREE.WebGLRenderer | null = null;

  // ─── Interaction driver lifecycle ────────────────────────────────────────
  private driver: ICameraInteractionDriver | null = null;
  private isInteractionActive = false;
  private savedSceneState: SceneCamera | null = null;

  // ─── Scene change tracking ───────────────────────────────────────────────
  private lastSceneIndex = -1;

  // ─── Camera reference for reset fallback ────────────────────────────────
  private cameraRef: THREE.PerspectiveCamera | null = null;
  private lastTick: SceneTrackTick | null = null;

  // ─── Keyboard/context-menu listeners ────────────────────────────────────
  private resetKeyListener: ((e: KeyboardEvent) => void) | null = null;
  private contextMenuListener: ((e: MouseEvent) => void) | null = null;

  // ─── Custom DSL node handler ─────────────────────────────────────────────

  /**
   * Installed on the instance so WidgetRegistry can find it via CUSTOM_NODE_HANDLER.
   * Maps flat CameraProps to the nested SceneCamera structure.
   */
  readonly [CUSTOM_NODE_HANDLER] = (
    node: { props: CameraProps },
    api: { setWidgetState: (id: string, state: SceneCamera) => void },
  ): void => {
    const p = node.props;

    let descriptor: SceneCamera['descriptor'];
    if (p.mode === 'world' && 'position' in p && 'target' in p) {
      descriptor = { mode: 'world', position: p.position, target: p.target, up: p.up };
    } else if (p.mode === 'orbit' && 'target' in p && 'azimuth' in p) {
      descriptor = {
        mode: 'orbit',
        target: p.target,
        azimuth: p.azimuth,
        polar: p.polar,
        distance: p.distance,
        up: p.up,
      };
    } else if (p.mode === 'fitFloorDepth' && 'floorY' in p) {
      descriptor = {
        mode: 'fitFloorDepth',
        floorY: p.floorY,
        floorZMin: p.floorZMin,
        floorZMax: p.floorZMax,
        lookAtZ: p.lookAtZ,
        cameraX: p.cameraX,
        cameraY: p.cameraY,
      };
    } else {
      descriptor = {
        mode: 'fitBotHeight',
        targetId: (p as { targetId?: string }).targetId ?? '',
        targetHeight: (p as { targetHeight?: number }).targetHeight ?? 1,
        framingHeightPct: (p as { framingHeightPct?: number }).framingHeightPct ?? 0.4,
        heightOffset: (p as { heightOffset?: number }).heightOffset ?? 0,
        distanceOffset: (p as { distanceOffset?: number }).distanceOffset ?? 0,
      };
    }

    const state: SceneCamera = {
      enabled: true,
      descriptor,
      lens: {
        fov: p.fov,
        focalLength: p.focalLength,
        filmGauge: p.filmGauge,
        near: p.near,
        far: p.far,
      },
      post: p.exposure !== undefined ? { exposure: p.exposure } : undefined,
      interaction: p.interaction,
      transitionIn: p.transitionIn,
    };
    api.setWidgetState(this.widgetId, state);
  };

  // ─── ISceneElement ───────────────────────────────────────────────────────

  mergeSnapshot(prev: SceneCamera | undefined, next: SceneCamera | undefined): SceneCamera | undefined {
    if (!prev && !next) return undefined;
    if (!next) return prev;
    if (!prev) return next;

    const baseDescriptor = prev.descriptor;
    const nextDescriptor = next.descriptor;
    const descriptor =
      baseDescriptor.mode === nextDescriptor.mode
        ? ({ ...baseDescriptor, ...nextDescriptor } as SceneCamera['descriptor'])
        : nextDescriptor;

    return {
      ...prev,
      ...next,
      descriptor,
      lens: { ...prev.lens, ...next.lens },
      post: { ...prev.post, ...next.post },
      interaction: next.interaction ?? prev.interaction,
      transitionIn: next.transitionIn ?? prev.transitionIn,
    };
  }

  // ─── IAnimationController ────────────────────────────────────────────────

  onTick(context: AnimationTickContext): void {
    const tick = context.tick;
    if (!tick) return;

    const camera = context.scene.userData[CAMERA_KEY] as THREE.PerspectiveCamera | undefined;
    if (!camera) return;
    this.cameraRef = camera;
    this.lastTick = tick;

    // Focus requests can be emitted by other widgets (e.g. DiagramCanvasWidget).
    // When interaction mode is active, delegate to the interaction driver for smooth motion.
    // Otherwise, promote the focus request into camera override state so authored camera state
    // does not immediately overwrite it on the next apply().
    const focus = context.scene.userData[CAMERA_FOCUS_KEY] as
      | { position: Vec3; target: Vec3; smooth?: boolean }
      | undefined;
    if (focus) {
      if (this.isInteractionActive && this.driver) {
        this.driver.setLookAt(focus.position, focus.target, focus.smooth !== false);
      } else {
        context.scene.userData[CAMERA_OVERRIDE_KEY] = {
          enabled: true,
          position: focus.position,
          target: focus.target,
          up: [camera.up.x, camera.up.y, camera.up.z] as Vec3,
          fov: camera.fov,
          near: camera.near,
          far: camera.far,
        };
      }
      delete context.scene.userData[CAMERA_FOCUS_KEY];
    }

    // Lazy-init DOM element + renderer from scene.userData (not available at construction)
    if (!this.domElement) {
      const renderer = context.scene.userData[RENDERER_KEY] as THREE.WebGLRenderer | undefined;
      if (renderer) {
        this.domElement = renderer.domElement;
        this.rendererRef = renderer;
      }
    }

    // Override path: bypass scene-driven + interactive camera
    const override = context.scene.userData[CAMERA_OVERRIDE_KEY] as CameraOverrideState | undefined;
    if (override?.enabled) {
      if (this.isInteractionActive) this.exitInteractionMode();
      applyCamera(
        {
          enabled: true,
          descriptor: { mode: 'world', position: override.position, target: override.target, up: override.up },
          lens: { fov: override.fov, near: override.near, far: override.far },
          post: override.exposure !== undefined ? { exposure: override.exposure } : undefined,
        },
        { camera, tick, renderer: this.rendererRef ?? undefined },
      );
      return;
    }

    // Resolve current scene camera state from functional block or pre-baked tick
    const functionalBlock = context.track?.transitionBlocks?.[tick.sceneIndex];
    const functionalWidget = functionalBlock?.widgetFns[this.widgetId];
    const state = functionalWidget
      ? (functionalWidget.fn(tick.blockProgress) as SceneCamera)
      : ((tick.state.widgets[this.widgetId] as SceneCamera | undefined) ?? this.defaultState);

    const wantsInteraction = state.interaction?.enabled === true;

    // Seed camera position before camera-controls takes over (prevents zero-distance orbit)
    if (wantsInteraction && !this.isInteractionActive) {
      applyCamera({ ...state, enabled: true }, { camera, tick, renderer: this.rendererRef ?? undefined });
      this.enterInteractionMode(state, camera, tick);
    } else if (!wantsInteraction && this.isInteractionActive) {
      this.exitInteractionMode();
    }

    if (this.isInteractionActive && this.driver) {
      // Re-configure each tick so scene-state changes (speeds, constraints) propagate live
      if (state.interaction) this.driver.configure(state.interaction);

      // Smooth reset when user navigates to a different scene
      if (tick.sceneIndex !== this.lastSceneIndex && this.lastSceneIndex !== -1) {
        this.savedSceneState = state;
        if (state.interaction?.resetOnSceneChange !== false) {
          const pos = extractWorldPosFromDescriptor(state.descriptor)
            ?? this.resolveWorldPos(state, camera, tick);
          if (pos) this.driver.setLookAt(pos.position, pos.target, true);
        }
      }
      this.lastSceneIndex = tick.sceneIndex;
      this.driver.update(context.effectiveDeltaSeconds);
      return;
    }

    this.lastSceneIndex = tick.sceneIndex;

    // Scene-driven: apply compiled camera state each tick
    applyCamera(state, { camera, tick, renderer: this.rendererRef ?? undefined });
  }

  dispose(): void {
    this.exitInteractionMode();
    this.domElement = null;
    this.rendererRef = null;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Returns true when camera interaction is active and claims wheel events.
   * useEngineInput reads this to suppress wheel-based scene navigation.
   */
  isWheelClaimedByInteraction(): boolean {
    if (!this.isInteractionActive || !this.driver) return false;
    return this.driver.claimsWheel();
  }

  // ─── Interaction mode management ──────────────────────────────────────────

  private enterInteractionMode(
    state: SceneCamera,
    camera: THREE.PerspectiveCamera,
    tick: SceneTrackTick,
  ): void {
    if (!this.domElement || !state.interaction) return;

    // Create and attach the driver
    this.driver = this.driverFactory(camera, this.domElement, state.interaction);

    // Sync driver's internal look-at to scene-defined position
    const pos = extractWorldPosFromDescriptor(state.descriptor)
      ?? this.resolveWorldPos(state, camera, tick);
    if (pos) {
      this.driver.setLookAt(pos.position, pos.target, false);
      this.driver.update(0);
    }

    this.savedSceneState = state;
    this.isInteractionActive = true;

    // Prevent native context menu on right-click (no longer used for pan, but keeps UX clean)
    this.contextMenuListener = (e: MouseEvent) => e.preventDefault();
    this.domElement.addEventListener('contextmenu', this.contextMenuListener);
    this.domElement.style.pointerEvents = 'auto';

    // Keyboard reset shortcut
    const resetCombo = state.interaction.reset;
    if (resetCombo !== false) {
      const combo = resetCombo ?? { key: 'r' };
      this.resetKeyListener = (e: KeyboardEvent) => {
        if (e.key !== combo.key) return;
        const mods = combo.modifiers ?? [];
        const ok =
          (!mods.includes('alt') || e.altKey) &&
          (!mods.includes('ctrl') || e.ctrlKey) &&
          (!mods.includes('meta') || e.metaKey) &&
          (!mods.includes('shift') || e.shiftKey);
        if (!ok) return;
        e.preventDefault();
        if (this.savedSceneState) {
          const cam = this.cameraRef;
          const t = this.lastTick ?? undefined;
          const p = extractWorldPosFromDescriptor(this.savedSceneState.descriptor)
            ?? (cam && t ? this.resolveWorldPos(this.savedSceneState, cam, t) : null);
          if (p) this.driver?.setLookAt(p.position, p.target, true);
        }
      };
      this.domElement.addEventListener('keydown', this.resetKeyListener);
    }
  }

  private exitInteractionMode(): void {
    if (this.resetKeyListener && this.domElement) {
      this.domElement.removeEventListener('keydown', this.resetKeyListener);
      this.resetKeyListener = null;
    }
    if (this.contextMenuListener && this.domElement) {
      this.domElement.removeEventListener('contextmenu', this.contextMenuListener);
      this.contextMenuListener = null;
    }
    this.driver?.dispose();
    this.driver = null;
    this.isInteractionActive = false;
    this.savedSceneState = null;
    this.lastSceneIndex = -1;
  }

  /**
   * Resolves a world-space {position, target} for modes that cannot be derived
   * from the descriptor alone (fitBotHeight, fitFloorDepth).
   * For world/orbit modes, use extractWorldPosFromDescriptor() instead.
   */
  private resolveWorldPos(
    state: SceneCamera,
    camera: THREE.PerspectiveCamera,
    tick?: SceneTrackTick,
  ): { position: Vec3; target: Vec3 } | null {
    const d = state.descriptor;
    if (d.mode === 'fitFloorDepth') {
      const lookAtZ = d.lookAtZ ?? (d.floorZMin + d.floorZMax) / 2;
      const cameraX = d.cameraX ?? 0;
      return {
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [cameraX, d.floorY, lookAtZ],
      };
    }
    if (d.mode === 'fitBotHeight') {
      if (!tick) return null;
      const raw = tick.state.widgets[d.targetId] as ModelStateForCamera | undefined;
      const targetPos = raw?.model?.position;
      if (!targetPos) return null;
      return {
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: targetPos,
      };
    }
    return null;
  }
}
