// CameraControlsDriver.ts — interactive camera driver for scroll-to-orbit mode.
// Wraps the camera-controls npm package. One instance per CameraWidget.

import CameraControls from 'camera-controls';
import * as THREE from 'three';
import type { ICameraInteractionDriver, TrackpadCameraConfig, Vec3 } from './types';

type CameraControlsThree = Parameters<typeof CameraControls.install>[0]['THREE'];

/**
 * Guards CameraControls.install() — must run exactly once per JS environment.
 * camera-controls requires THREE to be registered globally before first use.
 *
 * KNOWN LIMITATION: If a second WebGLRenderer is created in the same process after
 * the first CameraControlsDriver is instantiated (e.g., in tests or multi-engine pages),
 * the install is already done and this guard is correct. The library itself is the
 * constraint here, not this implementation.
 */
let ccInstalled = false;

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
    if (!ccInstalled) {
      CameraControls.install({ THREE: THREE as unknown as CameraControlsThree });
      ccInstalled = true;
    }
    const camera = cameraObject as THREE.PerspectiveCamera;
    type CCCamera = ConstructorParameters<typeof CameraControls>[0];
    this.cc = new CameraControls(camera as unknown as CCCamera, domElement);
    this.domElement = domElement;
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
      const wheelLockIdleMs = cfg.wheelLockIdleMs ?? 160;
      const wheelAxisDominance = cfg.wheelAxisDominance ?? 1.2;
      const wheelAxisActivationThreshold = cfg.wheelAxisActivationThreshold ?? 10;
      // Cmd+Shift wheel: orbit with modifier-held axis lock.
      // Axis is chosen from accumulated movement and kept until one modifier is released.
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (this.wheelRotateLastTs > 0 && now - this.wheelRotateLastTs > wheelLockIdleMs) {
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
        if (total >= wheelAxisActivationThreshold) {
          if (this.wheelRotateAccumX > this.wheelRotateAccumY * wheelAxisDominance) {
            this.wheelRotateLockAxis = 'horizontal';
          } else if (this.wheelRotateAccumY > this.wheelRotateAccumX * wheelAxisDominance) {
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

}
