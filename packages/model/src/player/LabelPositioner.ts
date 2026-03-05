// Handles DOM positioning of label elements using 3D bone world-position projection.
// This is the label-only successor to AnnotationPositioner. No annotation logic here.

import { Vector3 } from 'three';
import type { Camera } from 'three';
import type { NVSRect } from '@brewsite/core';
import type { LabelResolved } from '../labels/types';

/**
 * Manages DOM element registration and per-frame CSS-transform positioning
 * for label elements. Called once per render loop tick.
 */
export class LabelPositioner {
  private elements = new Map<string, HTMLElement>();
  private containerWidth = 0;
  private containerHeight = 0;
  private warnedMissingTargets = new Set<string>();
  private nvsBounds: NVSRect = { x: 0, y: 0, w: 1, h: 1 };

  registerElement(id: string, el: HTMLElement | null): void {
    if (el) {
      this.elements.set(id, el);
    } else {
      this.elements.delete(id);
    }
  }

  /**
   * Updates the container dimensions and optional NVS sub-region bounds.
   * When `nvsBounds` is omitted, defaults to the fullscreen rect { x:0, y:0, w:1, h:1 }.
   */
  setContainerSize(width: number, height: number, nvsBounds?: NVSRect): void {
    this.containerWidth = width;
    this.containerHeight = height;
    this.nvsBounds = nvsBounds ?? { x: 0, y: 0, w: 1, h: 1 };
  }

  update(
    labels: LabelResolved[],
    camera: Camera,
    namedPositions: ReadonlyMap<string, [number, number, number]>,
    targetColors?: ReadonlyMap<string, string>,
  ): void {
    if (this.containerWidth <= 0 || this.containerHeight <= 0) return;

    for (const label of labels) {
      const el = this.elements.get(label.id);
      if (!el) continue;
      if (label.enabled === false) {
        el.style.display = 'none';
        continue;
      }
      const targetId = label.targetPartId;
      const bonePos = namedPositions.get(targetId);
      if (!bonePos) {
        if (!this.warnedMissingTargets.has(targetId)) {
          console.warn(`[LabelPositioner] missing target part "${targetId}" for label "${label.id}"`);
          this.warnedMissingTargets.add(targetId);
        }
        continue;
      }
      const targetColor = targetColors?.get(targetId);
      const offset = label.labelOffset ?? [0, 0, 0];
      const targetScreen = projectToScreen(
        [bonePos[0], bonePos[1], bonePos[2]],
        camera,
        this.containerWidth,
        this.containerHeight,
        this.nvsBounds,
      );
      const labelScreen = projectToScreen(
        [bonePos[0] + offset[0], bonePos[1] + offset[1], bonePos[2] + offset[2]],
        camera,
        this.containerWidth,
        this.containerHeight,
        this.nvsBounds,
      );
      const width = el.offsetWidth || 0;
      const height = el.offsetHeight || 0;
      const dx = targetScreen.x - labelScreen.x;
      const dy = targetScreen.y - labelScreen.y;
      const anchorX = dx >= 0 ? width : 0;
      const anchorY = dy >= 0 ? height : 0;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = length > 0.0001 ? (Math.atan2(dy, dx) * 180) / Math.PI : 0;
      el.style.setProperty('--label-line-length', `${length}px`);
      el.style.setProperty('--label-line-angle', `${angle}deg`);
      el.style.setProperty('--label-line-origin-x', `${anchorX}px`);
      el.style.setProperty('--label-line-origin-y', `${anchorY}px`);
      if (label.style?.color === 'target-color' && targetColor) {
        el.style.setProperty('--label-color', targetColor);
      } else {
        el.style.removeProperty('--label-color');
      }
      if (label.style?.lineColor === 'target-color' && targetColor) {
        el.style.setProperty('--label-line-color', targetColor);
      } else {
        el.style.removeProperty('--label-line-color');
      }
      el.style.transform = `translate(${labelScreen.x - anchorX}px, ${labelScreen.y - anchorY}px)`;
      el.style.display = '';
    }
  }
}

/**
 * Projects a 3D world position to 2D pixel coordinates within the AR-locked container,
 * scoped to the NVS sub-region the model occupies.
 *
 * Steps:
 * 1. vec.project(camera) → NDC in [-1, 1]
 * 2. Compute the sub-region's pixel footprint within the container:
 *      regionLeft   = nvsBounds.x * containerWidth
 *      regionTop    = nvsBounds.y * containerHeight
 *      regionWidth  = nvsBounds.w * containerWidth
 *      regionHeight = nvsBounds.h * containerHeight
 * 3. Map NDC to pixel offset within that footprint:
 *      x = regionLeft + (ndcX * 0.5 + 0.5) * regionWidth
 *      y = regionTop  + (-ndcY * 0.5 + 0.5) * regionHeight
 *
 * The returned (x, y) are in the same coordinate space as the EngineOverlayHost div
 * (absolute pixels from the AR container top-left).
 */
const projectToScreen = (
  worldPos: [number, number, number],
  camera: Camera,
  containerWidth: number,
  containerHeight: number,
  nvsBounds: NVSRect,
): { x: number; y: number } => {
  const vec = new Vector3(worldPos[0], worldPos[1], worldPos[2]);
  vec.project(camera);
  const regionLeft   = nvsBounds.x * containerWidth;
  const regionTop    = nvsBounds.y * containerHeight;
  const regionWidth  = nvsBounds.w * containerWidth;
  const regionHeight = nvsBounds.h * containerHeight;
  const x = regionLeft   + (vec.x * 0.5 + 0.5) * regionWidth;
  const y = regionTop    + (-vec.y * 0.5 + 0.5) * regionHeight;
  return { x, y };
};
