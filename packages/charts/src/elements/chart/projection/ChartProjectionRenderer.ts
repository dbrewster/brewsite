// ChartProjectionRenderer — Three.js beam + landing dot for Y-axis projection.
// Owned by ChartRenderer as a child of chartGroup. Ticked by ChartWidget.onTick().

import * as THREE from 'three';
import type { ChartHitInfo } from '../../../renderers/shared/IChartRenderer';
import type { ChartProjectionTokens } from '../../../themes/types';

/** Hardcoded darkGlass fallback — used when theme.projection is absent. */
export const DEFAULT_PROJECTION_TOKENS: ChartProjectionTokens = {
  color:                '#E36A2E',
  emissiveIntensity:    0.8,
  beamWidth:            0.004,
  opacity:              0.85,
  dotRadius:            0.022,
  dotEmissiveIntensity: 1.1,
  animationDurationMs:  220,
};

/** Exit animation duration in ms — fixed, not theme-configurable. */
const EXIT_DURATION_MS = 160;

type ProjectionState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'entering'; readonly startTime: number }
  | { readonly kind: 'holding' }
  | { readonly kind: 'exiting'; readonly startTime: number };

/** ease-out-expo: fast start, exponential deceleration to final value. */
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * Manages the Y-axis projection beam and landing dot in the Three.js scene.
 * Lives as a child of ChartRenderer's chartGroup.
 * Lifecycle: updateProjection() on hover events → tick() every RAF frame.
 */
export class ChartProjectionRenderer {
  private readonly projectionGroup: THREE.Group;
  private beamMesh: THREE.Mesh | null = null;
  private dotMesh: THREE.Mesh | null = null;
  private animState: ProjectionState = { kind: 'idle' };
  private readonly getNow: () => number;

  /**
   * @param chartGroup  The chartGroup from ChartRenderer — projectionGroup is added as child.
   * @param getNow      Optional time provider for deterministic testing. Default: performance.now.
   */
  constructor(
    private readonly chartGroup: THREE.Group,
    getNow: () => number = () => performance.now(),
  ) {
    this.projectionGroup = new THREE.Group();
    chartGroup.add(this.projectionGroup);
    this.getNow = getNow;
  }

  /**
   * Called by ChartRenderer.updateProjection() when hover state changes.
   * Non-null info: start (or restart) entrance animation.
   * Null info: start exit animation.
   */
  updateProjection(info: ChartHitInfo | null, tokens: ChartProjectionTokens): void {
    if (info === null) {
      if (this.animState.kind !== 'idle') {
        this.animState = { kind: 'exiting', startTime: this.getNow() };
      }
      return;
    }

    if (!info.projectionTarget) {
      // Renderer does not provide projection (pie, heatmap) — stay idle
      this.animState = { kind: 'idle' };
      this.hideGeometry();
      return;
    }

    // Snap to new position and restart entrance (re-trigger behavior)
    this.rebuildGeometry(info, tokens);
    this.animState = { kind: 'entering', startTime: this.getNow() };
  }

  /**
   * Called every RAF frame by ChartWidget.onTick() via ChartRenderer.tickProjection().
   * Advances entrance / holding / exit animations.
   */
  tick(tokens: ChartProjectionTokens): void {
    if (this.animState.kind === 'idle') return;

    const now = this.getNow();

    switch (this.animState.kind) {
      case 'entering': {
        const elapsed = now - this.animState.startTime;
        const progress = Math.min(elapsed / tokens.animationDurationMs, 1.0);
        const eased = easeOutExpo(progress);

        if (this.beamMesh) this.beamMesh.scale.x = eased;
        if (this.beamMesh) (this.beamMesh.material as THREE.MeshBasicMaterial).opacity = tokens.opacity * eased;
        if (this.dotMesh)  (this.dotMesh.material  as THREE.MeshBasicMaterial).opacity = tokens.opacity * eased;

        if (progress >= 1.0) {
          if (this.beamMesh) this.beamMesh.scale.x = 1.0;
          this.animState = { kind: 'holding' };
        }
        break;
      }

      case 'holding': {
        // Landing dot pulse: sin(time * 0.004) maps ms → ~4 rad/s pulse
        const pulse = Math.sin(now * 0.004) * 0.15 + 1.0;
        if (this.dotMesh) this.dotMesh.scale.set(pulse, pulse, 1);
        break;
      }

      case 'exiting': {
        const elapsed = now - this.animState.startTime;
        const progress = Math.min(elapsed / EXIT_DURATION_MS, 1.0);
        const opacity = tokens.opacity * (1.0 - progress);

        if (this.beamMesh) (this.beamMesh.material as THREE.MeshBasicMaterial).opacity = opacity;
        if (this.dotMesh)  (this.dotMesh.material  as THREE.MeshBasicMaterial).opacity = opacity;

        if (progress >= 1.0) {
          this.hideGeometry();
          this.animState = { kind: 'idle' };
        }
        break;
      }
    }
  }

  /** Release Three.js resources. Called by ChartRenderer.dispose(). */
  dispose(): void {
    this.clearGeometry();
    this.chartGroup.remove(this.projectionGroup);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  /**
   * Creates or replaces beam + dot geometry for the given hit info.
   * Beam geometry: BoxGeometry, pivot at data-point end, extends toward Y-axis.
   * Beam position in projectionGroup (= chartGroup local) space.
   */
  private rebuildGeometry(info: ChartHitInfo, tokens: ChartProjectionTokens): void {
    this.clearGeometry();

    const hitX  = info.point[0] - this.chartGroup.position.x;
    const hitY  = info.point[1] - this.chartGroup.position.y;
    const hitZ  = info.point[2] - this.chartGroup.position.z;

    const targetX = info.projectionTarget![0] - this.chartGroup.position.x;

    const beamLength = Math.abs(hitX - targetX);
    if (beamLength < 1e-5) return; // degenerate — skip

    // Beam: BoxGeometry with width = beamLength, height = beamWidth, depth = 0.001 (flat)
    // Translate geometry so x=0 is at the data-point end (pivot for scale.x animation)
    const direction = targetX < hitX ? -1 : 1;
    const beamGeo = new THREE.BoxGeometry(beamLength, tokens.beamWidth, 0.001);
    beamGeo.translate(direction * beamLength / 2, 0, 0);

    const beamMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(tokens.color),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.beamMesh = new THREE.Mesh(beamGeo, beamMat);
    this.beamMesh.position.set(hitX, hitY, hitZ);
    this.beamMesh.scale.x = 0; // entrance animation starts at 0

    // Landing dot: PlaneGeometry at projectionTarget, same orientation as beam
    const dotDiameter = tokens.dotRadius * 2;
    const dotGeo = new THREE.PlaneGeometry(dotDiameter, dotDiameter);
    const dotMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(tokens.color),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.dotMesh = new THREE.Mesh(dotGeo, dotMat);
    this.dotMesh.position.set(targetX, hitY, hitZ);

    this.projectionGroup.add(this.beamMesh, this.dotMesh);
  }

  private hideGeometry(): void {
    if (this.beamMesh) this.beamMesh.visible = false;
    if (this.dotMesh)  this.dotMesh.visible  = false;
  }

  private clearGeometry(): void {
    if (this.beamMesh) {
      this.projectionGroup.remove(this.beamMesh);
      this.beamMesh.geometry.dispose();
      (this.beamMesh.material as THREE.Material).dispose();
      this.beamMesh = null;
    }
    if (this.dotMesh) {
      this.projectionGroup.remove(this.dotMesh);
      this.dotMesh.geometry.dispose();
      (this.dotMesh.material as THREE.Material).dispose();
      this.dotMesh = null;
    }
  }
}
