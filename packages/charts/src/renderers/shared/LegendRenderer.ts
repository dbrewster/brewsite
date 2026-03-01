// Renders series legend swatches and labels in the legendGroup.

import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { ensureText } from '@brewsite/core';
import type { TextWithLayout } from '@brewsite/core';
import type { ChartSeriesState } from './IChartRenderer';
import type { ChartTheme } from '../../themes/types';

type LegendEntry = {
  swatch: THREE.Mesh;
  label: TextWithLayout;
};

/**
 * Manages legend swatches (BoxGeometry) + troika Text labels in the legendGroup.
 * Handles incremental updates and disposal.
 */
export class LegendRenderer {
  private entries: LegendEntry[] = [];

  constructor(private readonly legendGroup: THREE.Group) {}

  update(
    series: readonly ChartSeriesState[],
    theme: ChartTheme,
    opacity: number,
  ): void {
    // Remove excess entries
    while (this.entries.length > series.length) {
      const entry = this.entries.pop()!;
      this.legendGroup.remove(entry.swatch);
      entry.swatch.geometry.dispose();
      (entry.swatch.material as THREE.Material).dispose();
      if (entry.label instanceof THREE.Object3D) {
        this.legendGroup.remove(entry.label as unknown as THREE.Object3D);
      }
    }

    const swatchSize = 0.12;
    const rowHeight = 0.2;
    const startY = -((series.length - 1) * rowHeight) / 2;

    for (let i = 0; i < series.length; i++) {
      const s = series[i]!;
      const tokens = theme.series[i % theme.series.length]!;
      const color = s.color ?? tokens.color;
      const y = startY + i * rowHeight;

      let entry = this.entries[i];
      if (!entry) {
        // Create swatch
        const swatchGeo = new THREE.BoxGeometry(swatchSize, swatchSize, 0.04);
        const swatchMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(color) });
        const swatch = new THREE.Mesh(swatchGeo, swatchMat);
        swatch.position.set(0, y, 0);
        this.legendGroup.add(swatch);

        // Create label
        const label = new Text() as unknown as TextWithLayout;
        label.userData = {};
        (label as unknown as THREE.Object3D).position.set(swatchSize * 0.8, y, 0);
        this.legendGroup.add(label as unknown as THREE.Object3D);

        entry = { swatch, label };
        this.entries[i] = entry;
      }

      // Update swatch
      (entry.swatch.material as THREE.MeshPhysicalMaterial).color.set(new THREE.Color(color));
      (entry.swatch.material as THREE.MeshPhysicalMaterial).opacity = opacity;
      (entry.swatch.material as THREE.MeshPhysicalMaterial).transparent = opacity < 1;
      entry.swatch.position.set(0, y, 0);

      // Update label
      const labelObj = entry.label as unknown as THREE.Object3D;
      labelObj.position.set(swatchSize * 0.8, y, 0);
      ensureText(
        entry.label,
        s.label ?? s.field,
        theme.axis.labelColor,
        theme.axis.fontSize,
        opacity,
        undefined,
        false,
        { anchorX: 'left', anchorY: 'middle' },
      );
    }
  }

  dispose(): void {
    for (const entry of this.entries) {
      this.legendGroup.remove(entry.swatch);
      entry.swatch.geometry.dispose();
      (entry.swatch.material as THREE.Material).dispose();
      if (entry.label instanceof THREE.Object3D) {
        this.legendGroup.remove(entry.label as unknown as THREE.Object3D);
      }
    }
    this.entries = [];
  }
}
