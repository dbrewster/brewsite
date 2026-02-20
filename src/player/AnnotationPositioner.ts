import { Vector3 } from 'three';
import type { Camera } from 'three';
import type { AnnotationResolved } from '../annotations/annotationTypes';
import type { LabelResolved } from '../labels/types';

export class AnnotationPositioner {
  private elements = new Map<string, HTMLElement>();
  private containerWidth = 0;
  private containerHeight = 0;

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
    annotations: AnnotationResolved[],
    labels: LabelResolved[],
    camera: Camera,
    boneWorldPositions: Map<string, [number, number, number]>,
  ): void {
    if (this.containerWidth <= 0 || this.containerHeight <= 0) return;

    for (const annotation of annotations) {
      const el = this.elements.get(annotation.id);
      if (!el) continue;

      let x = 0;
      let y = 0;

      if (annotation.placement.mode === 'fixed') {
        x =
          annotation.placement.reference.x === 'left'
            ? 0
            : annotation.placement.reference.x === 'right'
            ? this.containerWidth
            : this.containerWidth / 2;
        y =
          annotation.placement.reference.y === 'top'
            ? 0
            : annotation.placement.reference.y === 'bottom'
            ? this.containerHeight
            : this.containerHeight / 2;
        x += annotation.placement.offset.xPct * this.containerWidth;
        y += annotation.placement.offset.yPct * this.containerHeight;
      } else {
        const bonePos = boneWorldPositions.get(annotation.placement.targetPartId);
        if (!bonePos) continue;
        const offset = annotation.placement.targetOffset ?? [0, 0, 0];
        const screen = projectToScreen(
          [bonePos[0] + offset[0], bonePos[1] + offset[1], bonePos[2] + offset[2]],
          camera,
          this.containerWidth,
          this.containerHeight,
        );
        x = screen.x + (annotation.placement.screenOffset?.xPct ?? 0) * this.containerWidth;
        y = screen.y + (annotation.placement.screenOffset?.yPct ?? 0) * this.containerHeight;
      }

      el.style.transform = `translate(${x}px, ${y}px)`;
      el.style.display = annotation.enabled === false ? 'none' : '';
    }

    for (const label of labels) {
      const el = this.elements.get(label.id);
      if (!el) continue;
      if (label.enabled === false) {
        el.style.display = 'none';
        continue;
      }
      const bonePos = boneWorldPositions.get(label.targetPartId);
      if (!bonePos) continue;
      const offset = label.labelOffset ?? [0, 0, 0];
      const screen = projectToScreen(
        [bonePos[0] + offset[0], bonePos[1] + offset[1], bonePos[2] + offset[2]],
        camera,
        this.containerWidth,
        this.containerHeight,
      );
      el.style.transform = `translate(${screen.x}px, ${screen.y}px)`;
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
