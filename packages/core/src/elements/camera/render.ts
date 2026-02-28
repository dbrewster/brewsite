// Camera element renderer — Three.js camera control.
// ONLY file in the camera module that may import Three.js.

import * as THREE from 'three';
import CameraControls from 'camera-controls';
import type { SceneTrackTick } from '../../compiler/sceneTrackTypes';
import type { SceneModelInstanceState } from '../model/types';
import type { SceneCamera, ICameraInteractionDriver, TrackpadCameraConfig, Vec3 } from './types';

// Install camera-controls THREE subset (called once at module load)
type CameraControlsThree = Parameters<typeof CameraControls.install>[0]['THREE'];
CameraControls.install({ THREE: THREE as unknown as CameraControlsThree });

export type CameraRenderContext = {
  camera: THREE.PerspectiveCamera;
  tick: SceneTrackTick;
  /**
   * Renderer reference, used for exposure application.
   * Read from scene.userData['__brewsite_renderer'] in CameraWidget.
   */
  renderer?: THREE.WebGLRenderer;
};

// ─── Helpers (preserved from v1) ─────────────────────────────────────────

const degToRad = (deg: number): number => (deg * Math.PI) / 180;

const getTargetState = (tick: SceneTrackTick, targetId: string): SceneModelInstanceState | null => {
  const raw = tick.state.widgets[targetId] as SceneModelInstanceState | undefined;
  if (!raw?.model?.position) return null;
  return raw;
};

const computeRayIntersectionZ = (
  camera: THREE.PerspectiveCamera,
  ndcY: number,
  floorY: number,
): number | null => {
  const origin = camera.position.clone();
  const point = new THREE.Vector3(0, ndcY, 0.5).unproject(camera);
  const dir = point.sub(origin).normalize();
  if (Math.abs(dir.y) < 1e-6) return null;
  const t = (floorY - origin.y) / dir.y;
  if (!Number.isFinite(t) || t <= 0) return null;
  return origin.z + dir.z * t;
};

const solveCameraZForFloor = (
  camera: THREE.PerspectiveCamera,
  params: {
    floorY: number; floorZMin: number; floorZMax: number;
    lookAtZ: number; cameraX: number; cameraY: number;
  },
): number | null => {
  const zMin = Math.min(params.floorZMin, params.floorZMax);
  const zMax = Math.max(params.floorZMin, params.floorZMax);
  let lo = zMax + 1;
  let hi = zMax + 5000;
  let bestZ = lo;
  let bestErr = Infinity;

  for (let i = 0; i < 30; i++) {
    const step = (hi - lo) / 4;
    const candidates = [lo, lo + step, lo + 2 * step, lo + 3 * step, hi];
    let bestIdx = 0;
    for (let c = 0; c < candidates.length; c++) {
      const z = candidates[c] as number;
      camera.position.set(params.cameraX, params.cameraY, z);
      camera.lookAt(params.cameraX, params.floorY, params.lookAtZ);
      camera.updateMatrixWorld(true);
      const zTop = computeRayIntersectionZ(camera, 1, params.floorY);
      const zBottom = computeRayIntersectionZ(camera, -1, params.floorY);
      if (zTop === null || zBottom === null) continue;
      const err = (zTop - zMin) ** 2 + (zBottom - zMax) ** 2;
      if (err < bestErr) { bestErr = err; bestZ = z; bestIdx = c; }
    }
    const center = candidates[bestIdx] as number;
    lo = Math.max(zMax + 1, center - step);
    hi = center + step;
  }
  return Number.isFinite(bestZ) ? bestZ : null;
};

// ─── Position application ────────────────────────────────────────────────

/**
 * Applies camera position and orientation from a SceneCamera state.
 * Call this on every tick (CameraWidget.onTick) UNLESS interactive mode is active.
 */
export const applyCamera = (state: SceneCamera, ctx: CameraRenderContext): void => {
  if (!state.enabled) return;
  const { camera, tick } = ctx;

  // Apply lens
  const lens = state.lens;
  if (lens) {
    if (lens.filmGauge !== undefined) camera.filmGauge = lens.filmGauge;
    if (lens.focalLength !== undefined) {
      camera.setFocalLength(lens.focalLength);
    } else if (lens.fov !== undefined) {
      camera.fov = lens.fov;
    }
    if (lens.near !== undefined) camera.near = lens.near;
    if (lens.far !== undefined) camera.far = lens.far;
    camera.updateProjectionMatrix();
  }

  // Apply post (exposure only — DoF is Phase 2)
  if (ctx.renderer && state.post?.exposure !== undefined) {
    ctx.renderer.toneMappingExposure = state.post.exposure;
  }

  const desc = state.descriptor;

  // World-space mode
  if (desc.mode === 'world') {
    camera.position.set(...desc.position);
    if (desc.up) camera.up.set(...desc.up);
    camera.lookAt(...desc.target);
    return;
  }

  // Orbit mode — convert spherical to Cartesian
  if (desc.mode === 'orbit') {
    const { target, azimuth, polar, distance } = desc;
    const x = target[0] + distance * Math.cos(polar) * Math.sin(azimuth);
    const y = target[1] + distance * Math.sin(polar);
    const z = target[2] + distance * Math.cos(polar) * Math.cos(azimuth);
    camera.position.set(x, y, z);
    if (desc.up) camera.up.set(...desc.up);
    camera.lookAt(...target);
    return;
  }

  // fitBotHeight mode (v1 preserved)
  if (desc.mode === 'fitBotHeight') {
    if (!desc.targetId || typeof desc.targetHeight !== 'number') return;
    const target = getTargetState(tick, desc.targetId);
    if (!target) return;
    const targetPos = target.model.position;
    const targetScale = target.model.scale ?? 1;
    const framing = desc.framingHeightPct ?? 0.4;
    if (framing <= 0) return;
    const fovRad = degToRad(lens?.fov ?? camera.fov ?? 45);
    const targetHeight = desc.targetHeight * targetScale;
    const distance = (targetHeight / framing) / (2 * Math.tan(fovRad / 2));
    const yOffset = desc.heightOffset ?? 0;
    const zOffset = desc.distanceOffset ?? 0;
    camera.position.set(targetPos[0], targetPos[1] + yOffset, targetPos[2] + distance + zOffset);
    camera.lookAt(targetPos[0], targetPos[1], targetPos[2]);
    return;
  }

  // fitFloorDepth mode (v1 preserved)
  if (desc.mode === 'fitFloorDepth') {
    if (
      typeof desc.floorY !== 'number' ||
      typeof desc.floorZMin !== 'number' ||
      typeof desc.floorZMax !== 'number'
    ) return;
    const lookAtZ = desc.lookAtZ ?? (desc.floorZMin + desc.floorZMax) / 2;
    const cameraX = desc.cameraX ?? 0;
    const cameraY = desc.cameraY ?? desc.floorY + 50;
    const solvedZ = solveCameraZForFloor(camera, {
      floorY: desc.floorY,
      floorZMin: desc.floorZMin,
      floorZMax: desc.floorZMax,
      lookAtZ,
      cameraX,
      cameraY,
    });
    if (typeof solvedZ !== 'number') return;
    camera.position.set(cameraX, cameraY, solvedZ);
    camera.lookAt(cameraX, desc.floorY, lookAtZ);
  }
};

// ─── Interactive Controls Driver ─────────────────────────────────────────

/**
 * Production implementation of ICameraInteractionDriver using camera-controls.
 * Disables all built-in camera-controls input bindings and drives the library
 * programmatically via rotate(), truck(), dolly() based on modifier-key events.
 *
 * Modifier key → action mapping:
 *   Ctrl  + left drag → rotate(azimuth, polar)
 *   Cmd   + left drag → rotate(azimuth, polar) [macOS]
 *   Cmd+Shift+left drag → rotate with axis lock (horizontal OR vertical) [macOS]
 *   Shift + left drag → truck(x, y)  [pan in screen space]
 *   Alt   + left drag → dolly(delta) [change distance to target]
 *   Shift + wheel     → truck(x, y)  [pan in screen space]
 *   Cmd   + wheel     → rotate(azimuth, polar) [macOS]
 *   Alt   + wheel     → dolly(delta) [when wheelZoom: true]
 */
export class CameraControlsDriver implements ICameraInteractionDriver {
  private cc: CameraControls | null = null;
  private domElement: HTMLElement | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private config: TrackpadCameraConfig | null = null;
  private wheelRotateLockAxis: 'horizontal' | 'vertical' | null = null;
  private wheelRotateAccumX = 0;
  private wheelRotateAccumY = 0;
  private wheelRotateLastTs = 0;

  // Drag tracking
  private dragState: {
    startX: number;
    startY: number;
    modifier: 'rotate' | 'pan' | 'zoom';
    rotateLockAxis: 'horizontal' | 'vertical' | null;
  } | null = null;

  // Bound event handlers (stored for cleanup)
  private readonly handlePointerDownBound: (e: PointerEvent) => void;
  private readonly handlePointerMoveBound: (e: PointerEvent) => void;
  private readonly handlePointerUpBound: (e: PointerEvent) => void;
  private readonly handleWheelBound: (e: WheelEvent) => void;

  constructor() {
    this.handlePointerDownBound = this.handlePointerDown.bind(this);
    this.handlePointerMoveBound = this.handlePointerMove.bind(this);
    this.handlePointerUpBound = this.handlePointerUp.bind(this);
    this.handleWheelBound = this.handleWheel.bind(this);
  }

  attach(cameraObject: unknown, domElement: HTMLElement, config: TrackpadCameraConfig): void {
    const camera = cameraObject as THREE.PerspectiveCamera;
    type CCCamera = ConstructorParameters<typeof CameraControls>[0];
    this.cc = new CameraControls(camera as unknown as CCCamera, domElement);
    this.domElement = domElement;
    this.camera = camera;
    this.config = config;

    // Disable ALL built-in camera-controls mouse/touch bindings.
    // We route pointer events to camera-controls' programmatic API ourselves.
    this.cc.mouseButtons.left = CameraControls.ACTION.NONE;
    this.cc.mouseButtons.right = CameraControls.ACTION.NONE;
    this.cc.mouseButtons.middle = CameraControls.ACTION.NONE;
    this.cc.mouseButtons.wheel = CameraControls.ACTION.NONE;
    this.cc.touches.one = CameraControls.ACTION.NONE;
    this.cc.touches.two = CameraControls.ACTION.NONE;
    this.cc.touches.three = CameraControls.ACTION.NONE;

    this.applyConfig(config);

    domElement.addEventListener('pointerdown', this.handlePointerDownBound);
    domElement.addEventListener('pointermove', this.handlePointerMoveBound);
    domElement.addEventListener('pointerup', this.handlePointerUpBound);
    domElement.addEventListener('pointercancel', this.handlePointerUpBound);
    domElement.addEventListener('wheel', this.handleWheelBound as EventListener, { passive: false });

    // Ensure pointer capture works
    domElement.style.touchAction = 'none';
  }

  setLookAt(position: Vec3, target: Vec3, smooth: boolean): void {
    this.cc?.setLookAt(
      position[0], position[1], position[2],
      target[0], target[1], target[2],
      smooth,
    );
  }

  update(deltaSeconds: number): boolean {
    return this.cc?.update(deltaSeconds) ?? false;
  }

  configure(config: TrackpadCameraConfig): void {
    this.config = config;
    if (this.cc) this.applyConfig(config);
  }

  claimsWheel(): boolean {
    // Return false: we only intercept Alt+wheel (which scene nav ignores anyway
    // because modifiersMatch() rejects events with unexpected modifiers held).
    // Return true only if the caller wants ALL wheel events claimed.
    return false;
  }

  dispose(): void {
    const el = this.domElement;
    if (el) {
      el.removeEventListener('pointerdown', this.handlePointerDownBound);
      el.removeEventListener('pointermove', this.handlePointerMoveBound);
      el.removeEventListener('pointerup', this.handlePointerUpBound);
      el.removeEventListener('pointercancel', this.handlePointerUpBound);
      el.removeEventListener('wheel', this.handleWheelBound as EventListener);
    }
    this.cc?.dispose();
    this.cc = null;
    this.domElement = null;
    this.camera = null;
    this.dragState = null;
    this.wheelRotateLockAxis = null;
    this.wheelRotateAccumX = 0;
    this.wheelRotateAccumY = 0;
    this.wheelRotateLastTs = 0;
    this.config = null;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private applyConfig(config: TrackpadCameraConfig): void {
    const cc = this.cc;
    if (!cc) return;

    if (config.damping === false) {
      cc.smoothTime = 0;
      cc.draggingSmoothTime = 0;
    } else {
      const t = typeof config.damping === 'number' ? config.damping : 0.25;
      cc.smoothTime = t;
      cc.draggingSmoothTime = t * 0.5;
    }

    if (config.minDistance !== undefined) cc.minDistance = config.minDistance;
    if (config.maxDistance !== undefined) cc.maxDistance = config.maxDistance;
    if (config.minPolarAngle !== undefined) cc.minPolarAngle = config.minPolarAngle;
    if (config.maxPolarAngle !== undefined) cc.maxPolarAngle = config.maxPolarAngle;
  }

  private resolveModifier(
    e: PointerEvent,
    cfg: TrackpadCameraConfig,
  ): 'rotate' | 'pan' | 'zoom' | null {
    if (e.metaKey && e.shiftKey && cfg.rotate !== false) return 'rotate';
    if ((e.ctrlKey || e.metaKey) && cfg.rotate !== false) return 'rotate';
    if (e.shiftKey && cfg.pan !== false) return 'pan';
    if (e.altKey && cfg.zoom !== false) return 'zoom';
    return null;
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.button !== 0 && e.button !== 2) return; // Left (or Ctrl-click/right on macOS)
    const cfg = this.config;
    if (!cfg) return;

    const modifier = this.resolveModifier(e, cfg);
    if (!modifier) return;

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // setPointerCapture may throw in certain environments (e.g. jsdom); safe to ignore
    }
    this.dragState = { startX: e.clientX, startY: e.clientY, modifier, rotateLockAxis: null };
    e.preventDefault();
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.cc) return;
    const cfg = this.config!;

    if (!this.dragState) {
      if (e.buttons === 0) return;
      const modifier = this.resolveModifier(e, cfg);
      if (!modifier) return;
      this.dragState = { startX: e.clientX, startY: e.clientY, modifier, rotateLockAxis: null };
    } else {
      // Modifiers can change mid-drag; re-resolve so Cmd+Shift can switch a Shift-pan
      // gesture into rotate-with-lock regardless of key press order.
      const modifier = this.resolveModifier(e, cfg);
      if (modifier && modifier !== this.dragState.modifier) {
        this.dragState.modifier = modifier;
        this.dragState.rotateLockAxis = null;
        this.dragState.startX = e.clientX;
        this.dragState.startY = e.clientY;
        return;
      }
    }

    const dx = e.clientX - this.dragState.startX;
    const dy = e.clientY - this.dragState.startY;
    // Update start each move for incremental delta (not absolute from drag-start)
    this.dragState.startX = e.clientX;
    this.dragState.startY = e.clientY;

    const w = this.domElement?.clientWidth ?? 800;
    const h = this.domElement?.clientHeight ?? 600;

    switch (this.dragState.modifier) {
      case 'rotate': {
        let rotateDx = dx;
        let rotateDy = dy;
        // Cmd+Shift drag constrains orbit to a single axis for this gesture.
        if (e.metaKey && e.shiftKey) {
          if (this.dragState.rotateLockAxis === null && (dx !== 0 || dy !== 0)) {
            this.dragState.rotateLockAxis = Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical';
          }
          if (this.dragState.rotateLockAxis === 'horizontal') {
            rotateDy = 0;
          } else if (this.dragState.rotateLockAxis === 'vertical') {
            rotateDx = 0;
          }
        } else {
          this.dragState.rotateLockAxis = null;
        }
        const speed = (cfg.rotate && typeof cfg.rotate === 'object' ? cfg.rotate.speed : undefined) ?? 1;
        // Full canvas-width drag = 2pi azimuth, full canvas-height drag = pi polar
        const azimuth = -(rotateDx / w) * Math.PI * 2 * speed;
        const polar = -(rotateDy / h) * Math.PI * speed;
        void this.cc.rotate(azimuth, polar, false);
        break;
      }
      case 'pan': {
        const speed = (cfg.pan && typeof cfg.pan === 'object' ? cfg.pan.speed : undefined) ?? 1;
        // Normalize to [0..1] range; camera-controls truck() takes world-space delta
        // relative to the current look-at distance. Using 0.01 * speed as a
        // proportional scale (tune per scene via speed).
        void this.cc.truck((dx / w) * speed, -(dy / h) * speed, false);
        break;
      }
      case 'zoom': {
        const speed = (cfg.zoom && typeof cfg.zoom === 'object' ? cfg.zoom.speed : undefined) ?? 1;
        // Positive dy (drag down) = zoom out (increase distance)
        const delta = (dy / h) * 3 * speed;
        void this.cc.dolly(delta, false);
        break;
      }
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (this.dragState) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // safe to ignore
      }
      this.dragState = null;
    }
  }

  private handleWheel(e: WheelEvent): void {
    if (!this.cc) return;
    const cfg = this.config;
    if (!cfg) return;

    if (e.metaKey && e.shiftKey && cfg.rotate !== false) {
      e.preventDefault();
      e.stopPropagation();
      const speed = (cfg.rotate && typeof cfg.rotate === 'object' ? cfg.rotate.speed : undefined) ?? 1;
      // Cmd+Shift wheel: orbit with modifier-held axis lock.
      // Axis is chosen from accumulated movement and kept until one modifier is released.
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (this.wheelRotateLastTs > 0 && now - this.wheelRotateLastTs > 160) {
        // New two-finger swipe gesture while keys are still held: allow re-lock.
        this.wheelRotateLockAxis = null;
        this.wheelRotateAccumX = 0;
        this.wheelRotateAccumY = 0;
      }
      this.wheelRotateLastTs = now;
      if (this.wheelRotateLockAxis === null) {
        this.wheelRotateAccumX += Math.abs(e.deltaX);
        this.wheelRotateAccumY += Math.abs(e.deltaY);
        const total = this.wheelRotateAccumX + this.wheelRotateAccumY;
        const dominance = 1.2;
        if (total >= 10) {
          if (this.wheelRotateAccumX > this.wheelRotateAccumY * dominance) {
            this.wheelRotateLockAxis = 'horizontal';
          } else if (this.wheelRotateAccumY > this.wheelRotateAccumX * dominance) {
            this.wheelRotateLockAxis = 'vertical';
          }
        }
        if (this.wheelRotateLockAxis === null) {
          return;
        }
      }
      const dx = this.wheelRotateLockAxis === 'horizontal'
        ? (Math.abs(e.deltaX) > 0.001 ? e.deltaX : e.deltaY)
        : 0;
      const dy = this.wheelRotateLockAxis === 'vertical' ? e.deltaY : 0;
      const azimuth = -(dx / 100) * Math.PI * 0.25 * speed;
      const polar = -(dy / 100) * Math.PI * 0.25 * speed;
      void this.cc.rotate(azimuth, polar, false);
      return;
    }

    this.wheelRotateLockAxis = null;
    this.wheelRotateAccumX = 0;
    this.wheelRotateAccumY = 0;
    this.wheelRotateLastTs = 0;

    if (e.shiftKey && cfg.pan !== false) {
      e.preventDefault();
      e.stopPropagation();
      const speed = (cfg.pan && typeof cfg.pan === 'object' ? cfg.pan.speed : undefined) ?? 1;
      const dx = (e.deltaX / 100) * speed;
      const dy = (e.deltaY / 100) * speed;
      void this.cc.truck(dx, -dy, false);
      return;
    }

    if (e.metaKey && cfg.rotate !== false) {
      e.preventDefault();
      e.stopPropagation();
      const speed = (cfg.rotate && typeof cfg.rotate === 'object' ? cfg.rotate.speed : undefined) ?? 1;
      const azimuth = -(e.deltaX / 100) * Math.PI * 0.25 * speed;
      const polar = -(e.deltaY / 100) * Math.PI * 0.25 * speed;
      void this.cc.rotate(azimuth, polar, false);
      return;
    }

    if (!cfg.wheelZoom) return;
    if (!e.altKey) return; // Alt+wheel only
    e.preventDefault();
    e.stopPropagation();
    const speed = (cfg.zoom && typeof cfg.zoom === 'object' ? cfg.zoom.speed : undefined) ?? 1;
    const delta = (e.deltaY / 100) * speed;
    void this.cc.dolly(delta, false);
  }

  private setTargetFromPointer(e: PointerEvent): void {
    const camera = this.camera;
    const cc = this.cc;
    const el = this.domElement;
    if (!camera || !cc || !el) return;

    const rect = el.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);

    const target = new THREE.Vector3();
    const getTarget = (cc as unknown as { getTarget?: (v: THREE.Vector3) => THREE.Vector3 }).getTarget;
    if (getTarget) {
      try {
        getTarget(target);
      } catch {
        // Some camera-controls internals may be uninitialized; fall back to a forward target.
        camera.getWorldDirection(target);
        target.multiplyScalar(10).add(camera.position);
      }
    } else {
      camera.getWorldDirection(target);
      target.multiplyScalar(10).add(camera.position);
    }

    const normal = new THREE.Vector3();
    camera.getWorldDirection(normal);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, target);

    const hit = new THREE.Vector3();
    const ok = raycaster.ray.intersectPlane(plane, hit);
    if (!ok) return;

    const pos = camera.position;
    cc.setLookAt(pos.x, pos.y, pos.z, hit.x, hit.y, hit.z, false);
  }
}
