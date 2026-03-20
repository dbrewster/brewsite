// CameraWidget — ISceneElement + IAnimationController.
// Manages both scene-driven and interactive camera modes.

import type {
  SceneCamera,
  Vec3,
  ICameraInteractionDriver,
  CameraInteractionDriverFactory,
  CameraInteractionDefaults,
  ICameraHost,
} from './types';
import type * as THREE from 'three';
import { DEFAULT_CAMERA, functionalCameraTransitionSpec, extractWorldPosFromDescriptor, compileNvsViewportCamera } from './compile';
import type { CameraProps } from './dsl';
import { applyCamera } from './render';
import { CameraControlsDriver } from './CameraControlsDriver';
import type {
  AnimationTickContext,
  IAnimationController,
  ISceneElement,
  IRenderable,
  ICameraFocusTarget,
  RuntimeCameraOverride,
  WidgetInitContext,
  WidgetRenderContext,
} from '../../widget/types';
import { CUSTOM_NODE_HANDLER } from '../../widget/WidgetRegistry';
import type { SceneTrackTick } from '../../compiler/sceneTrackTypes';

/** Camera DSL component — returns null; consumed purely by the compiler. */
export const Camera = (_props: CameraProps): null => null;

Camera.displayName = 'Camera';

/** Minimal model state shape used for camera target resolution. Full type lives in @brewsite/model. */
type ModelStateForCamera = { model?: { position?: [number, number, number] } };

const defaultDriverFactory: CameraInteractionDriverFactory = (cameraObject, domElement, config) => {
  const driver = new CameraControlsDriver();
  driver.attach(cameraObject, domElement, config);
  return driver;
};

export class CameraWidget
  implements
    ISceneElement<SceneCamera>,
    IRenderable<SceneCamera>,
    IAnimationController,
    ICameraHost,
    ICameraFocusTarget
{
  // Ambient: Camera configures the scene globally. Not an NVS-bounded canvas element.
  readonly nodeHandlerCategory = 'ambient' as const;
  readonly widgetId = 'camera';
  readonly defaultState: SceneCamera = DEFAULT_CAMERA;
  readonly transitionSpec = functionalCameraTransitionSpec;
  readonly DslComponent = Camera;
  readonly disableWhenAbsent = true;

  constructor(
    /**
     * Factory that creates an ICameraInteractionDriver, attaches it, and returns it.
     * Defaults to creating a CameraControlsDriver (production implementation).
     * Inject a FakeInteractionDriver factory in tests.
     */
    private readonly driverFactory: CameraInteractionDriverFactory = defaultDriverFactory,
  ) {}

  // ─── Renderer / DOM references (injected via initialize()) ──────────────
  private domElement: HTMLElement | null = null;
  private rendererRef: THREE.WebGLRenderer | null = null;

  // ─── Pending focus override (from requestFocus in non-interaction mode) ─
  private _pendingFocusOverride: RuntimeCameraOverride | null = null;

  // ─── Interaction driver lifecycle ────────────────────────────────────────
  private driver: ICameraInteractionDriver | null = null;
  private isInteractionActive = false;
  private savedSceneState: SceneCamera | null = null;

  // ─── Scene change tracking ───────────────────────────────────────────────
  private lastSceneIndex = -1;
  private interactionDefaults: CameraInteractionDefaults | null = null;

  // ─── Camera reference for reset fallback ────────────────────────────────
  private cameraRef: THREE.PerspectiveCamera | null = null;
  private lastTick: SceneTrackTick | null = null;

  // ─── Orbit/dolly state ────────────────────────────────────────────────────
  /** Last known look-at target; updated from scene state in onTick. Used for orbit/dolly. */
  private _lastKnownTarget: [number, number, number] = [0, 0, 0];
  private static readonly ORBIT_SENSITIVITY = 0.005;
  private static readonly DOLLY_SENSITIVITY = 0.020;
  private static readonly PAN_SENSITIVITY = 0.01;
  private static readonly MIN_POLAR = -Math.PI / 2 + 0.05;
  private static readonly MAX_POLAR = Math.PI / 2 - 0.05;

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

    // nvsViewport is compiled to a world-mode SceneCamera at compile time.
    if (p.mode === 'nvsViewport') {
      const compiled = compileNvsViewportCamera(
        (p as { worldScale?: number }).worldScale,
        (p as { zRange?: number }).zRange,
      );
      api.setWidgetState(this.widgetId, compiled);
      return;
    }

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

  // ─── IRenderable<SceneCamera> ────────────────────────────────────────────

  /** Receives Three.js camera and renderer at engine mount via RuntimeDriverImpl.initialize(). */
  initialize(context: WidgetInitContext): void {
    if (context.camera) {
      this.cameraRef = context.camera;
    }
    if (context.renderer) {
      this.rendererRef = context.renderer;
      this.domElement = context.renderer.domElement;
    }
  }

  /**
   * IRenderable.apply — no-op.
   * CameraWidget drives itself via IAnimationController.onTick(), not apply().
   * onTick() reads context.resolvedState so compiled camera state does not need
   * to be re-read here.
   */
  apply(_state: SceneCamera, _context: WidgetRenderContext): void {}

  // ─── ICameraFocusTarget ──────────────────────────────────────────────────

  /**
   * Request a camera focus to a world-space position and target.
   * When interaction is active: delegates to the driver for smooth motion.
   * When not active: stores a pending override for the next onTick().
   */
  requestFocus(
    position: readonly [number, number, number],
    target: readonly [number, number, number],
    smooth = true,
  ): void {
    if (this.isInteractionActive && this.driver) {
      this.driver.setLookAt(position as Vec3, target as Vec3, smooth);
    } else if (this.cameraRef) {
      this._pendingFocusOverride = {
        enabled: true,
        position,
        target,
        up: [this.cameraRef.up.x, this.cameraRef.up.y, this.cameraRef.up.z],
        fov: this.cameraRef.fov,
        near: this.cameraRef.near,
        far: this.cameraRef.far,
      };
    }
  }

  // ─── IAnimationController ────────────────────────────────────────────────

  onTick(context: AnimationTickContext): void {
    const tick = context.tick;
    if (!tick) return;

    const camera = this.cameraRef;
    if (!camera) return;
    this.lastTick = tick;

    // Drain pending focus override: apply it IMMEDIATELY in this tick AND store
    // it on the driver so subsequent ticks continue using it. Previously the
    // override was only stored (for the NEXT tick), causing a one-frame delay
    // where the camera showed the compiled SceneTrack position before jumping
    // to the orbit position — visible as a ghosting/double-image.
    if (this._pendingFocusOverride) {
      context.setCameraOverride(this._pendingFocusOverride);
    }

    // Use the pending override (this tick) or the stored override (subsequent ticks).
    const override = this._pendingFocusOverride ?? context.cameraOverride;
    this._pendingFocusOverride = null;
    if (override?.enabled) {
      if (this.isInteractionActive) this.exitInteractionMode();
      // Track target so orbit/dolly calculations have an up-to-date reference.
      if (override.target) {
        this._lastKnownTarget = [override.target[0] as number, override.target[1] as number, override.target[2] as number];
      }
      applyCamera(
        {
          enabled: true,
          descriptor: { mode: 'world', position: override.position as Vec3, target: override.target as Vec3, up: override.up as Vec3 | undefined },
          lens: { fov: override.fov, near: override.near, far: override.far },
          post: override.exposure !== undefined ? { exposure: override.exposure } : undefined,
        },
        { camera, tick, renderer: this.rendererRef ?? undefined },
      );
      return;
    }

    // Resolved state path — eliminates manual functional block re-evaluation.
    const state = (context.resolvedState as SceneCamera | undefined) ?? this.defaultState;

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
      const interaction = this.resolveInteractionConfig(state.interaction);
      if (interaction) this.driver.configure(interaction);

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

    // Scene-driven: apply compiled camera state each tick.
    // Update last known target from the descriptor before applying.
    this._updateLastKnownTargetFromState(state);
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

  setInteractionDefaults(defaults: CameraInteractionDefaults | null | undefined): void {
    this.interactionDefaults = defaults ?? null;
  }

  /**
   * Applies an orbital rotation delta to the camera around the last known look-at target.
   * Sets a pending focus override that is applied on the next onTick().
   *
   * @param dx - Horizontal pixel delta (azimuth). Positive rotates right.
   * @param dy - Vertical pixel delta (polar elevation). Positive moves camera down in screen space.
   * @param speed - Multiplier applied to the sensitivity constant.
   */
  applyCameraOrbit(dx: number, dy: number, speed: number): void {
    const camera = this.cameraRef;
    if (!camera) return;

    const target = this._lastKnownTarget;
    const ox = camera.position.x - target[0];
    const oy = camera.position.y - target[1];
    const oz = camera.position.z - target[2];
    const distance = Math.sqrt(ox * ox + oy * oy + oz * oz);
    if (distance < 1e-6) return;

    // Convert to spherical: polar = elevation from equator, azimuth = angle around Y-axis.
    let polar = Math.asin(Math.max(-1, Math.min(1, oy / distance)));
    let azimuth = Math.atan2(ox, oz);

    // Apply deltas. Invert dy so drag-up (negative screen-y delta) raises the camera.
    azimuth += dx * CameraWidget.ORBIT_SENSITIVITY * speed;
    polar -= dy * CameraWidget.ORBIT_SENSITIVITY * speed;
    polar = Math.max(CameraWidget.MIN_POLAR, Math.min(CameraWidget.MAX_POLAR, polar));

    const cosPolar = Math.cos(polar);
    const newX = target[0] + distance * cosPolar * Math.sin(azimuth);
    const newY = target[1] + distance * Math.sin(polar);
    const newZ = target[2] + distance * cosPolar * Math.cos(azimuth);

    this._pendingFocusOverride = {
      enabled: true,
      position: [newX, newY, newZ],
      target,
      up: [camera.up.x, camera.up.y, camera.up.z],
      fov: camera.fov,
      near: camera.near,
      far: camera.far,
    };
  }

  /**
   * Applies a dolly (zoom) delta along the camera-to-target axis.
   * Sets a pending focus override that is applied on the next onTick().
   *
   * @param delta - Signed distance. Positive zooms in toward the target.
   * @param speed - Multiplier applied to the sensitivity constant.
   */
  applyCameraDolly(delta: number, speed: number): void {
    const camera = this.cameraRef;
    if (!camera) return;

    const target = this._lastKnownTarget;
    const dx = target[0] - camera.position.x;
    const dy = target[1] - camera.position.y;
    const dz = target[2] - camera.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 1e-6) return;

    // Distance-proportional zoom: move faster when far, slower when close.
    // This matches the natural expectation (like Google Maps) and ensures the
    // camera feels responsive at any zoom level. Floor at 0.5 prevents stalling
    // when very close to the target.
    const distanceFactor = Math.max(0.5, dist);
    const move = delta * speed * CameraWidget.DOLLY_SENSITIVITY * distanceFactor;
    // Clamp so camera cannot pass through the target or retreat excessively.
    const clampedMove = Math.max(-dist * 2, Math.min(dist * 0.9, move));

    const newX = camera.position.x + (dx / dist) * clampedMove;
    const newY = camera.position.y + (dy / dist) * clampedMove;
    const newZ = camera.position.z + (dz / dist) * clampedMove;

    this._pendingFocusOverride = {
      enabled: true,
      position: [newX, newY, newZ],
      target,
      up: [camera.up.x, camera.up.y, camera.up.z],
      fov: camera.fov,
      near: camera.near,
      far: camera.far,
    };
  }

  /**
   * Applies a pan delta in the camera's local XY plane (truck left/right, pedestal up/down).
   * Sets a pending focus override that is applied on the next onTick().
   *
   * @param dx - Horizontal pixel delta. Positive pans right.
   * @param dy - Vertical pixel delta. Positive pans down in screen space.
   * @param speed - Multiplier applied to the sensitivity constant.
   */
  applyCameraPan(dx: number, dy: number, speed: number): void {
    const camera = this.cameraRef;
    if (!camera) return;

    const target = this._lastKnownTarget;

    // Compute camera-right and camera-up vectors.
    // right = normalize(forward × up)
    const forward = {
      x: target[0] - camera.position.x,
      y: target[1] - camera.position.y,
      z: target[2] - camera.position.z,
    };
    const upVec = { x: camera.up.x, y: camera.up.y, z: camera.up.z };

    // right = forward × up
    const right = {
      x: forward.y * upVec.z - forward.z * upVec.y,
      y: forward.z * upVec.x - forward.x * upVec.z,
      z: forward.x * upVec.y - forward.y * upVec.x,
    };
    const rightLen = Math.sqrt(right.x * right.x + right.y * right.y + right.z * right.z);
    if (rightLen < 1e-6) return;
    right.x /= rightLen;
    right.y /= rightLen;
    right.z /= rightLen;

    // Re-compute camera-up from right × forward (orthonormal).
    const cameraUp = {
      x: right.y * (-forward.z) - right.z * (-forward.y),
      y: right.z * (-forward.x) - right.x * (-forward.z),
      z: right.x * (-forward.y) - right.y * (-forward.x),
    };
    const upLen = Math.sqrt(cameraUp.x * cameraUp.x + cameraUp.y * cameraUp.y + cameraUp.z * cameraUp.z);
    if (upLen > 1e-6) {
      cameraUp.x /= upLen;
      cameraUp.y /= upLen;
      cameraUp.z /= upLen;
    }

    const panScale = speed * CameraWidget.PAN_SENSITIVITY;

    // Pan camera + target together (strafe, not orbit).
    const offsetX = -dx * panScale * right.x + dy * panScale * cameraUp.x;
    const offsetY = -dx * panScale * right.y + dy * panScale * cameraUp.y;
    const offsetZ = -dx * panScale * right.z + dy * panScale * cameraUp.z;

    const newPos: [number, number, number] = [
      camera.position.x + offsetX,
      camera.position.y + offsetY,
      camera.position.z + offsetZ,
    ];
    const newTarget: [number, number, number] = [
      target[0] + offsetX,
      target[1] + offsetY,
      target[2] + offsetZ,
    ];

    this._pendingFocusOverride = {
      enabled: true,
      position: newPos,
      target: newTarget,
      up: [camera.up.x, camera.up.y, camera.up.z],
      fov: camera.fov,
      near: camera.near,
      far: camera.far,
    };
  }

  // ─── Interaction mode management ──────────────────────────────────────────

  private enterInteractionMode(
    state: SceneCamera,
    camera: THREE.PerspectiveCamera,
    tick: SceneTrackTick,
  ): void {
    const interaction = this.resolveInteractionConfig(state.interaction);
    if (!this.domElement || !interaction) return;

    // Create and attach the driver
    this.driver = this.driverFactory(camera, this.domElement, interaction);

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
    const resetCombo = interaction.reset;
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

  /** Updates _lastKnownTarget from a scene state descriptor when the target is explicit. */
  private _updateLastKnownTargetFromState(state: SceneCamera): void {
    const d = state.descriptor;
    if (d.mode === 'world' && d.target) {
      this._lastKnownTarget = [d.target[0], d.target[1], d.target[2]];
    } else if (d.mode === 'orbit' && d.target) {
      this._lastKnownTarget = [d.target[0], d.target[1], d.target[2]];
    }
  }

  private resolveInteractionConfig(
    interaction: SceneCamera['interaction'],
  ): SceneCamera['interaction'] {
    if (!interaction || !this.interactionDefaults) return interaction;
    return {
      ...interaction,
      wheelLockIdleMs: interaction.wheelLockIdleMs ?? this.interactionDefaults.wheelLockIdleMs,
      wheelAxisDominance: interaction.wheelAxisDominance ?? this.interactionDefaults.wheelAxisDominance,
      wheelAxisActivationThreshold:
        interaction.wheelAxisActivationThreshold ?? this.interactionDefaults.wheelAxisActivationThreshold,
      minPolarAngle: interaction.minPolarAngle ?? this.interactionDefaults.orbitPolarMin,
      maxPolarAngle: interaction.maxPolarAngle ?? this.interactionDefaults.orbitPolarMax,
      minDistance: interaction.minDistance ?? this.interactionDefaults.dollyRadiusMin,
      maxDistance: interaction.maxDistance ?? this.interactionDefaults.dollyRadiusMax,
    };
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
