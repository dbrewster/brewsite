import * as THREE from 'three';
import type { GroupRenderEntry, TextWithLayout } from './types';
import type { DiagramGroupState } from '../types';
import { ensureText } from './TextRenderer';
import { Text } from 'troika-three-text';

export class GroupRenderer {
  private readonly entries = new Map<string, GroupRenderEntry>();

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
    const entry = this.createGroup(state);
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

  private createGroup(state: DiagramGroupState): GroupRenderEntry {
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
    const borderMaterial =
      state.borderStyle === 'dashed'
        ? new THREE.LineDashedMaterial({
          color: state.borderColor,
          opacity: state.borderOpacity,
          transparent: true,
          dashSize: 0.3,
          gapSize: 0.2,
        })
        : new THREE.LineBasicMaterial({
          color: state.borderColor,
          opacity: state.borderOpacity,
          transparent: true,
        });
    const border = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), borderMaterial);
    if (borderMaterial instanceof THREE.LineDashedMaterial) {
      border.computeLineDistances();
    }
    const label = new Text() as TextWithLayout;
    group.add(fill, border, label);
    return { group, fill, border, label, lastState: state };
  }

  private updateGroup(entry: GroupRenderEntry, state: DiagramGroupState): void {
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
      entry.border.geometry.dispose();
      entry.border.geometry = new THREE.EdgesGeometry(geometry);
    }

    const fillMat = entry.fill.material as THREE.MeshBasicMaterial;
    fillMat.color.set(state.color);
    fillMat.opacity = state.fillOpacity;
    fillMat.transparent = true;

    const borderMat = entry.border.material as THREE.LineBasicMaterial | THREE.LineDashedMaterial;
    if (state.borderStyle === 'dashed' && !(borderMat instanceof THREE.LineDashedMaterial)) {
      entry.border.material = new THREE.LineDashedMaterial({
        color: state.borderColor,
        opacity: state.borderOpacity,
        transparent: true,
        dashSize: 0.3,
        gapSize: 0.2,
      });
    }
    if (state.borderStyle === 'solid' && !(borderMat instanceof THREE.LineBasicMaterial)) {
      entry.border.material = new THREE.LineBasicMaterial({
        color: state.borderColor,
        opacity: state.borderOpacity,
        transparent: true,
      });
    }
    const activeMat = entry.border.material as THREE.LineBasicMaterial | THREE.LineDashedMaterial;
    activeMat.color.set(state.borderColor);
    activeMat.opacity = state.borderOpacity;
    activeMat.transparent = true;
    if (activeMat instanceof THREE.LineDashedMaterial) {
      entry.border.computeLineDistances();
    }

    ensureText(
      entry.label,
      state.label,
      '#ffffff',
      Math.max(0.4, state.bounds.h * 0.08),
      1,
      state.bounds.w - 0.8,
      true,
    );
    entry.label.position.set(
      -state.bounds.w / 2 + 0.4,
      state.bounds.h / 2 + 0.4,
      0.01,
    );

    entry.lastState = state;
  }

  private disposeGroup(entry: GroupRenderEntry): void {
    entry.fill.geometry.dispose();
    (entry.fill.material as THREE.Material).dispose();
    entry.border.geometry.dispose();
    (entry.border.material as THREE.Material).dispose();
    entry.label.geometry.dispose();
  }
}
