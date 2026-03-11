// Shared data label renderer using troika-three-text — manages Text instances for data value labels.

import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { ensureText } from '@brewsite/core';
import type { TextWithLayout } from '@brewsite/core';
import type { ChartTheme } from '../../themes/types';
import type { DataLabelEntry } from './IChartRenderer';

/**
 * Manages troika-three-text label instances for data value labels.
 * Called by per-type renderers when ctx.dataLabels is non-null.
 * Alignment-based offsets:
 *   'above'   → +0.06 Z (bar-top labels)
 *   'center'  → no offset (pie mid-slice labels)
 *   'outside' → +0.08 radial outward offset (pie exploded-slice labels)
 */
export class DataLabelRenderer {
  private readonly labelGroup: THREE.Group;
  private texts: TextWithLayout[] = [];

  constructor(group: THREE.Group) {
    this.labelGroup = group;
  }

  /**
   * Updates troika-three-text instances to match the provided label entries.
   * Reuses existing Text instances; creates or removes as count changes.
   * Applies alignment-based Z and Y offsets relative to entry.position.
   */
  update(
    entries: DataLabelEntry[],
    theme: ChartTheme,
    opacity: number,
    fontUrl?: string,
  ): void {
    // Shrink pool
    while (this.texts.length > entries.length) {
      const text = this.texts.pop()!;
      this.labelGroup.remove(text as unknown as THREE.Object3D);
      (text as unknown as { dispose?: () => void }).dispose?.();
    }

    // Grow pool
    while (this.texts.length < entries.length) {
      const text = new Text() as unknown as TextWithLayout;
      text.userData = {};
      this.labelGroup.add(text as unknown as THREE.Object3D);
      this.texts.push(text);
    }

    // Read font size and color from theme.dataLabels tokens; fall back to safe defaults
    const fontSize = theme.dataLabels?.fontSize ?? 0.05;
    const labelColor = theme.dataLabels?.color ?? '#ffffff';

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      const textObj = this.texts[i]!;
      const obj = textObj as unknown as THREE.Object3D;

      // Apply alignment offset
      let x = entry.position.x;
      let y = entry.position.y;
      let z = entry.position.z;

      if (entry.alignment === 'above') {
        z += 0.06;
      } else if (entry.alignment === 'outside') {
        // Radial outward: compute normalized direction from origin, offset by 0.08
        const dir = new THREE.Vector3(entry.position.x, entry.position.y, 0);
        const len = dir.length();
        if (len > 0) {
          dir.normalize().multiplyScalar(0.08);
          x += dir.x;
          y += dir.y;
        }
      }
      // 'center' — no offset

      obj.position.set(x, y, z);
      obj.renderOrder = 15;

      ensureText(textObj, entry.text, labelColor, fontSize, opacity, undefined, false, {
        anchorX: 'center',
        anchorY: 'bottom',
        fontUrl,
      });
    }
  }

  /** Removes all label text objects and releases resources. */
  dispose(): void {
    for (const text of this.texts) {
      this.labelGroup.remove(text as unknown as THREE.Object3D);
      (text as unknown as { dispose?: () => void }).dispose?.();
    }
    this.texts = [];
  }
}
