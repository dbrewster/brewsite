// CameraWidget — ISceneElement + IAnimationController.
// Manages both scene-driven and interactive camera modes.

import type { SceneCamera } from './types';
import type * as THREE from 'three';
import type CameraControls from 'camera-controls';
import { DEFAULT_CAMERA, functionalCameraTransitionSpec, extractWorldPosFromDescriptor } from './compile';
import { Camera } from './dsl';
import type { CameraProps } from './dsl';
import { applyCamera, createCameraControls } from './render';
import type { AnimationTickContext, IAnimationController, ISceneElement } from '../../widget/types';
import { CUSTOM_NODE_HANDLER } from '../../widget/WidgetRegistry';

const CAMERA_KEY = '__brewsite_camera';
const RENDERER_KEY = '__brewsite_renderer';

export { CUSTOM_NODE_HANDLER };

export class CameraWidget implements ISceneElement<SceneCamera>, IAnimationController {
  readonly widgetId = 'camera';
  readonly defaultState: SceneCamera = DEFAULT_CAMERA;
  readonly transitionSpec = functionalCameraTransitionSpec;
  readonly DslComponent = Camera;
  readonly useDefaultStateWhenAbsent = false;

  // Lazy-initialised on first onTick call (read from scene.userData)
  private domElement: HTMLElement | null = null;
  private rendererRef: THREE.WebGLRenderer | null = null;

  // camera-controls lifecycle
  private cameraControls: CameraControls | null = null;
  private isInteractionActive = false;

  // Scene change tracking for smooth reset
  private lastSceneIndex = -1;
  private savedCameraState: SceneCamera | null = null;

  // Keyboard reset listener (attached/detached with interaction mode)
  private resetKeyListener: ((e: KeyboardEvent) => void) | null = null;

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
    return { ...prev, ...next } as SceneCamera;
  }

  // ─── IAnimationController ────────────────────────────────────────────────

  onTick(context: AnimationTickContext): void {
    const tick = context.tick;
    if (!tick) return;

    const camera = context.scene.userData[CAMERA_KEY] as THREE.PerspectiveCamera | undefined;
    if (!camera) return;

    // Lazy-init DOM element and renderer on first tick (not available at construction time)
    if (!this.domElement) {
      const renderer = context.scene.userData[RENDERER_KEY] as THREE.WebGLRenderer | undefined;
      if (renderer) {
        this.domElement = renderer.domElement;
        this.rendererRef = renderer;
      }
    }

    // Resolve current scene camera state
    const functionalBlock = context.track?.transitionBlocks?.[tick.sceneIndex];
    const functionalWidget = functionalBlock?.widgetFns[this.widgetId];
    const state = functionalWidget
      ? (functionalWidget.fn(tick.blockProgress) as SceneCamera)
      : ((tick.state.widgets[this.widgetId] as SceneCamera | undefined) ?? this.defaultState);

    // Update camera-controls lifecycle
    this.updateInteractionMode(state, camera, tick.sceneIndex);

    // If interactive mode is active, camera-controls owns the camera transform
    if (this.isInteractionActive && this.cameraControls) {
      // Smooth reset when scene changes (unless opted out)
      if (tick.sceneIndex !== this.lastSceneIndex && this.lastSceneIndex !== -1) {
        this.savedCameraState = state; // update saved state to new scene definition
        if (state.interaction?.resetOnSceneChange !== false) {
          this.smoothResetToSceneCamera(state);
        }
      }
      this.lastSceneIndex = tick.sceneIndex;
      this.cameraControls.update(context.deltaSeconds);
      return;
    }

    this.lastSceneIndex = tick.sceneIndex;

    // Apply scene-driven camera position and exposure
    applyCamera(state, { camera, tick, renderer: this.rendererRef ?? undefined });
  }

  dispose(): void {
    this.exitInteractionMode();
    this.domElement = null;
    this.rendererRef = null;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Returns true when camera-controls is active AND wheel dolly is enabled.
   * useEngineInput reads this to suppress wheel-based scene navigation.
   */
  isWheelClaimedByInteraction(): boolean {
    if (!this.isInteractionActive) return false;
    const dolly = this.savedCameraState?.interaction?.dolly;
    return dolly !== false && (dolly?.wheel !== false);
  }

  // ─── Interaction mode management ──────────────────────────────────────────

  private updateInteractionMode(
    state: SceneCamera,
    camera: THREE.PerspectiveCamera,
    _sceneIndex: number,
  ): void {
    const wantsInteraction = state.interaction?.enabled === true;

    if (wantsInteraction && !this.isInteractionActive) {
      this.enterInteractionMode(state, camera);
    } else if (!wantsInteraction && this.isInteractionActive) {
      this.exitInteractionMode();
    }
  }

  private enterInteractionMode(state: SceneCamera, camera: THREE.PerspectiveCamera): void {
    if (!this.domElement || !state.interaction) return;
    this.cameraControls?.dispose();
    this.cameraControls = createCameraControls(camera, this.domElement, state.interaction);
    this.savedCameraState = state;
    this.isInteractionActive = true;

    // Keyboard reset listener
    const resetKey = state.interaction.reset ?? { key: 'r' };
    this.resetKeyListener = (e: KeyboardEvent) => {
      if (e.key === resetKey.key) {
        const mods = resetKey.modifiers ?? [];
        const ok =
          (!mods.includes('alt') || e.altKey) &&
          (!mods.includes('ctrl') || e.ctrlKey) &&
          (!mods.includes('meta') || e.metaKey) &&
          (!mods.includes('shift') || e.shiftKey);
        if (ok) {
          e.preventDefault();
          if (this.savedCameraState) this.smoothResetToSceneCamera(this.savedCameraState);
        }
      }
    };
    // Attach to domElement (requires tabIndex on canvas — set by EngineInputRegion)
    this.domElement.addEventListener('keydown', this.resetKeyListener);
  }

  private exitInteractionMode(): void {
    if (this.resetKeyListener && this.domElement) {
      this.domElement.removeEventListener('keydown', this.resetKeyListener);
      this.resetKeyListener = null;
    }
    this.cameraControls?.dispose();
    this.cameraControls = null;
    this.isInteractionActive = false;
    this.savedCameraState = null;
    this.lastSceneIndex = -1;
  }

  /**
   * Smoothly animate back to the scene-defined camera position.
   * Uses camera-controls' built-in smooth transition (governed by smoothTime,
   * ~0.25s with default damping). NOT a snap — the camera glides back.
   */
  private smoothResetToSceneCamera(state: SceneCamera): void {
    if (!this.cameraControls) return;
    const pos = extractWorldPosFromDescriptor(state.descriptor);
    if (!pos) return;
    this.cameraControls.setLookAt(
      pos.position[0], pos.position[1], pos.position[2],
      pos.target[0], pos.target[1], pos.target[2],
      true, // enableTransition — camera glides, not jumps
    );
  }
}
