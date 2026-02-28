import * as THREE from 'three';
import type { GroupRenderEntry, TextWithLayout } from './types';
import type { DiagramGroupState } from '../types';
import { ensureText } from './TextRenderer';
import { Text } from 'troika-three-text';
import type { IGroupInteractionRegistry } from './GroupInteractionRegistry';

export class GroupRenderer {
  // Converts "pixel-like" border width values from theme/state into diagram units.
  private static readonly BORDER_PX_TO_UNITS = 0.4;
  private static readonly BORDER_SIDE_DARKEN = 0.4;
  private readonly entries = new Map<string, GroupRenderEntry>();

  constructor(private readonly registry: IGroupInteractionRegistry) {}

  private key(diagramId: string, groupId: string): string {
    return `${diagramId}::${groupId}`;
  }

  getOrCreate(state: DiagramGroupState, diagramId: string, parent: THREE.Object3D): GroupRenderEntry {
    const key = this.key(diagramId, state.id);
    const existing = this.entries.get(key);
    if (existing) {
      this.updateGroup(existing, state);
      return existing;
    }
    const entry = this.createGroup(state, diagramId);
    parent.add(entry.group);
    this.entries.set(key, entry);
    return entry;
  }

  dispose(groupId: string, diagramId: string, parent: THREE.Object3D): void {
    const key = this.key(diagramId, groupId);
    const entry = this.entries.get(key);
    if (!entry) return;
    parent.remove(entry.group);
    this.disposeGroup(entry);
    this.entries.delete(key);
  }

  disposeAllForDiagram(diagramId: string, parent: THREE.Object3D): void {
    for (const [key, entry] of this.entries.entries()) {
      if (!key.startsWith(`${diagramId}::`)) continue;
      parent.remove(entry.group);
      this.disposeGroup(entry);
      this.entries.delete(key);
    }
  }

  private createGroup(state: DiagramGroupState, diagramId: string): GroupRenderEntry {
    const group = new THREE.Group();
    const geometry = new THREE.PlaneGeometry(state.bounds.w, state.bounds.h);
    const fill = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: state.color,
        opacity: state.fillOpacity,
        transparent: true,
        side: THREE.DoubleSide,
      }),
    );
    const label = new Text() as TextWithLayout;
    const border = this.createBorder(state);
    if (border) {
      group.add(fill, border, label);
    } else {
      group.add(fill, label);
    }
    this.registry.register(fill, diagramId, state.id);
    return { group, fill, border, label, lastState: state };
  }

  private disposeBorder(border: THREE.Group): void {
    border.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose());
      }
    });
  }

  private removeBorder(entry: GroupRenderEntry): void {
    if (!entry.border) return;
    entry.group.remove(entry.border);
    this.disposeBorder(entry.border);
    entry.border = undefined;
  }

  private updateGroup(entry: GroupRenderEntry, state: DiagramGroupState): void {
    if (!Number.isFinite(state.bounds.w) || !Number.isFinite(state.bounds.h)) {
      entry.group.visible = false;
      return;
    }
    entry.group.visible = true;
    const centerX = state.bounds.x + state.bounds.w / 2;
    const centerY = state.bounds.y + state.bounds.h / 2;
    entry.group.position.set(centerX, centerY, -0.6);

    const prev = entry.lastState;
    const boundsChanged =
      !prev ||
      prev.bounds.w !== state.bounds.w ||
      prev.bounds.h !== state.bounds.h;
    if (boundsChanged) {
      const geometry = new THREE.PlaneGeometry(state.bounds.w, state.bounds.h);
      entry.fill.geometry.dispose();
      entry.fill.geometry = geometry;
    }

    const fillMat = entry.fill.material as THREE.MeshBasicMaterial;
    fillMat.color.set(state.color);
    fillMat.opacity = state.fillOpacity;
    fillMat.transparent = true;
    entry.fill.visible = true;
    fillMat.opacity = state.variant === 'container' ? 0 : state.fillOpacity;
    fillMat.transparent = true;

    if (state.variant === 'container' || state.borderStyle === 'none') {
      this.removeBorder(entry);
    } else {
      const borderNeedsRebuild =
        !entry.border ||
        !prev ||
        prev.bounds.w !== state.bounds.w ||
        prev.bounds.h !== state.bounds.h ||
        prev.borderWidth !== state.borderWidth ||
        prev.borderHeight !== state.borderHeight ||
        prev.borderStyle !== state.borderStyle;

      if (borderNeedsRebuild) {
        this.removeBorder(entry);
        const border = this.createBorder(state);
        if (border) {
          entry.border = border;
          entry.group.add(border);
        }
      }

      if (entry.border) {
        entry.border.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            const mats = Array.isArray(obj.material)
              ? obj.material as THREE.MeshBasicMaterial[]
              : [obj.material as THREE.MeshBasicMaterial];
            if (mats[0]) {
              mats[0].color.set(state.borderColor);
              mats[0].opacity = state.borderOpacity;
              mats[0].transparent = true;
            }
            if (mats[1]) {
              mats[1].color.set(new THREE.Color(state.borderColor).multiplyScalar(GroupRenderer.BORDER_SIDE_DARKEN));
              mats[1].opacity = state.borderOpacity;
              mats[1].transparent = true;
            }
            return;
          }
          if (obj instanceof THREE.LineSegments) {
            const edgeMat = obj.material as THREE.LineBasicMaterial;
            edgeMat.color.set(new THREE.Color(state.borderColor).multiplyScalar(0.45));
            edgeMat.opacity = Math.min(1, state.borderOpacity + 0.1);
            edgeMat.transparent = true;
          }
        });
      }
    }

    const topPadding = Math.max(0, state.bounds.padding[0]);
    const titleInset = Math.min(Math.max(state.bounds.titleGap, 0), topPadding);
    const availableHalfBand = Math.max(0.2, Math.min(titleInset, topPadding - titleInset));
    const labelFontSize = Math.max(
      0.35,
      Math.min(state.bounds.h * 0.08, availableHalfBand * 1.6),
    );
    const labelInsetX = 0.7;
    if (state.label) {
      ensureText(
        entry.label,
        state.label,
        '#ffffff',
        labelFontSize,
        1,
        state.bounds.w - labelInsetX * 2,
        true,
        { anchorX: 'left', anchorY: 'middle', textAlign: 'left' },
      );
      // Position title text inside the top padding band so it never overlaps node content.
      const titleY = state.bounds.h / 2 - topPadding + titleInset;
      entry.label.position.set(
        -state.bounds.w / 2 + labelInsetX,
        titleY,
        0.01,
      );
      entry.label.visible = true;
    } else {
      entry.label.visible = false;
    }

    entry.lastState = state;
  }

  private disposeGroup(entry: GroupRenderEntry): void {
    this.registry.unregister(entry.fill);
    entry.fill.geometry.dispose();
    (entry.fill.material as THREE.Material).dispose();
    if (entry.border) {
      this.disposeBorder(entry.border);
    }
    entry.label.geometry.dispose();
  }

  private createBorder(state: DiagramGroupState): THREE.Group | undefined {
    if (state.borderStyle === 'none') return undefined;
    const border = new THREE.Group();
    const bw = Math.max(0.01, state.borderWidth * GroupRenderer.BORDER_PX_TO_UNITS);
    const bh = Math.max(0.01, state.borderHeight);
    const w = Math.max(0.01, state.bounds.w);
    const h = Math.max(0.01, state.bounds.h);
    const halfW = w / 2;
    const halfH = h / 2;
    const faceMat = new THREE.MeshBasicMaterial({
      color: state.borderColor,
      opacity: state.borderOpacity,
      transparent: true,
    });
    const sideMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(state.borderColor).multiplyScalar(GroupRenderer.BORDER_SIDE_DARKEN),
      opacity: state.borderOpacity,
      transparent: true,
    });

    // Single ring mesh gives mitered corners with no gaps and no corner overdraw.
    const outer = new THREE.Shape();
    outer.moveTo(-halfW - bw, -halfH - bw);
    outer.lineTo(halfW + bw, -halfH - bw);
    outer.lineTo(halfW + bw, halfH + bw);
    outer.lineTo(-halfW - bw, halfH + bw);
    outer.closePath();

    const inner = new THREE.Path();
    inner.moveTo(-halfW, -halfH);
    inner.lineTo(-halfW, halfH);
    inner.lineTo(halfW, halfH);
    inner.lineTo(halfW, -halfH);
    inner.closePath();
    outer.holes.push(inner);

    const geom = new THREE.ExtrudeGeometry(outer, {
      depth: bh,
      bevelEnabled: false,
    });
    geom.translate(0, 0, -bh / 2);
    const frameMesh = new THREE.Mesh(geom, [faceMat, sideMat]);
    const edgeLines = new THREE.LineSegments(
      new THREE.EdgesGeometry(geom),
      new THREE.LineBasicMaterial({
        color: new THREE.Color(state.borderColor).multiplyScalar(0.45),
        opacity: Math.min(1, state.borderOpacity + 0.1),
        transparent: true,
      }),
    );
    border.add(frameMesh, edgeLines);
    return border;
  }
}
