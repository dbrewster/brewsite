// Handles DOM positioning of label elements using 3D bone world-position projection.
// This is the label-only successor to AnnotationPositioner. No annotation logic here.

import { Vector3 } from 'three';
import type { Camera } from 'three';
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

  registerElement(id: string, el: HTMLElement | null): void {
    if (el) {
      this.elements.set(id, el);
    } else {
      this.elements.delete(id);
    }
  }

  setContainerSize(width: number, height: number): void {
    this.containerWidth = width;
    this.containerHeight = height;
  }

  update(
    labels: LabelResolved[],
    camera: Camera,
    boneWorldPositions: Map<string, [number, number, number]>,
    targetColors?: Map<string, string>,
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
      const bonePos = boneWorldPositions.get(targetId);
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
      );
      const labelScreen = projectToScreen(
        [bonePos[0] + offset[0], bonePos[1] + offset[1], bonePos[2] + offset[2]],
        camera,
        this.containerWidth,
        this.containerHeight,
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

const projectToScreen = (
  worldPos: [number, number, number],
  camera: Camera,
  width: number,
  height: number,
): { x: number; y: number } => {
  const vec = new Vector3(worldPos[0], worldPos[1], worldPos[2]);
  vec.project(camera);
  const x = (vec.x * 0.5 + 0.5) * width;
  const y = (-vec.y * 0.5 + 0.5) * height;
  return { x, y };
};
