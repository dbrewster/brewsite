// Renders series legend swatches and labels in the legendGroup — V2 adds title, columns, maxItems.

import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { ensureText } from '@brewsite/core';
import type { TextWithLayout } from '@brewsite/core';
import type { ChartSeriesState, ChartLegendState } from './IChartRenderer';
import type { ChartTheme } from '../../themes/types';

type LegendEntry = {
  swatch: THREE.Mesh;
  label: TextWithLayout;
};

/**
 * Manages legend swatches (BoxGeometry) + troika Text labels in the legendGroup.
 * V2 additions: title text, multi-column layout, maxItems truncation.
 * Handles incremental updates and disposal.
 */
export class LegendRenderer {
  private entries: LegendEntry[] = [];
  private titleLabel: TextWithLayout | null = null;
  private moreLabel: TextWithLayout | null = null;

  constructor(private readonly legendGroup: THREE.Group) {}

  update(
    series: readonly ChartSeriesState[],
    legend: ChartLegendState,
    theme: ChartTheme,
    opacity: number,
    fontUrl?: string,
  ): void {
    const { title, columns = 1, maxItems } = legend;
    const horizontal = legend.position === 'top' || legend.position === 'bottom';

    // Apply maxItems truncation
    const totalSeries = series.length;
    const visibleSeries = maxItems != null ? series.slice(0, maxItems) : series;
    const hasMore = maxItems != null && totalSeries > maxItems;

    // Remove excess entries
    while (this.entries.length > visibleSeries.length) {
      const entry = this.entries.pop()!;
      this.legendGroup.remove(entry.swatch);
      entry.swatch.geometry.dispose();
      (entry.swatch.material as THREE.Material).dispose();
      if (entry.label instanceof THREE.Object3D) {
        this.legendGroup.remove(entry.label as unknown as THREE.Object3D);
      }
    }

    const swatchSize = theme.legend.swatchSize;
    const rowHeight = theme.legend.spacing;
    // V2.1: textOpacity multiplied with scene opacity for label text
    const labelTextOpacity = (theme.legend.textOpacity ?? 1.0) * opacity;
    const titleOffset = title ? rowHeight * 1.2 : 0;
    const effectiveColumns = horizontal && columns > 1 ? columns : 1;

    for (let i = 0; i < visibleSeries.length; i++) {
      const s = visibleSeries[i]!;
      const tokens = theme.series[i % theme.series.length]!;
      const color = s.color ?? tokens.color;

      // Multi-column layout
      const col = i % effectiveColumns;
      const row = Math.floor(i / effectiveColumns);
      const colWidth = 0.5; // world units per column
      const x = col * colWidth;
      const y = -(row * rowHeight) - titleOffset;

      let entry = this.entries[i];
      if (!entry) {
        // Create swatch
        const swatchGeo = new THREE.BoxGeometry(swatchSize, swatchSize, 0.04);
        const swatchMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(color) });
        const swatch = new THREE.Mesh(swatchGeo, swatchMat);
        swatch.position.set(x, y, 0);
        this.legendGroup.add(swatch);

        // Create label
        const label = new Text() as unknown as TextWithLayout;
        label.userData = {};
        (label as unknown as THREE.Object3D).position.set(x + swatchSize * 0.8, y, 0);
        this.legendGroup.add(label as unknown as THREE.Object3D);

        entry = { swatch, label };
        this.entries[i] = entry;
      }

      // Update swatch
      (entry.swatch.material as THREE.MeshPhysicalMaterial).color.set(new THREE.Color(color));
      (entry.swatch.material as THREE.MeshPhysicalMaterial).opacity = opacity;
      (entry.swatch.material as THREE.MeshPhysicalMaterial).transparent = opacity < 1;
      entry.swatch.position.set(x, y, 0);

      // Update label
      const labelObj = entry.label as unknown as THREE.Object3D;
      labelObj.position.set(x + swatchSize * 0.8, y, 0);
      ensureText(
        entry.label,
        s.label ?? s.field,
        theme.legend.textColor,
        theme.legend.fontSize,
        labelTextOpacity,
        undefined,
        false,
        { anchorX: 'left', anchorY: 'middle', fontUrl },
      );
    }

    // Title label
    if (title) {
      if (!this.titleLabel) {
        this.titleLabel = new Text() as unknown as TextWithLayout;
        this.titleLabel.userData = {};
        this.legendGroup.add(this.titleLabel as unknown as THREE.Object3D);
      }
      const titleObj = this.titleLabel as unknown as THREE.Object3D;
      titleObj.position.set(0, 0, 0);
      titleObj.renderOrder = 10;
      ensureText(
        this.titleLabel,
        title,
        theme.legend.textColor,
        theme.legend.fontSize * 1.1,
        opacity,
        undefined,
        false,
        { anchorX: 'left', anchorY: 'bottom', fontUrl },
      );
    } else if (this.titleLabel) {
      this.legendGroup.remove(this.titleLabel as unknown as THREE.Object3D);
      this.titleLabel = null;
    }

    // "X more..." label
    if (hasMore) {
      const remaining = totalSeries - maxItems!;
      if (!this.moreLabel) {
        this.moreLabel = new Text() as unknown as TextWithLayout;
        this.moreLabel.userData = {};
        this.legendGroup.add(this.moreLabel as unknown as THREE.Object3D);
      }
      const moreRow = Math.ceil(visibleSeries.length / effectiveColumns);
      const moreY = -(moreRow * rowHeight) - titleOffset;
      const moreObj = this.moreLabel as unknown as THREE.Object3D;
      moreObj.position.set(0, moreY, 0);
      moreObj.renderOrder = 10;
      ensureText(
        this.moreLabel,
        `${remaining} more...`,
        theme.legend.textColor,
        theme.legend.fontSize * 0.85,
        opacity * 0.7,
        undefined,
        false,
        { anchorX: 'left', anchorY: 'middle', fontUrl },
      );
    } else if (this.moreLabel) {
      this.legendGroup.remove(this.moreLabel as unknown as THREE.Object3D);
      this.moreLabel = null;
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

    if (this.titleLabel) {
      this.legendGroup.remove(this.titleLabel as unknown as THREE.Object3D);
      this.titleLabel = null;
    }
    if (this.moreLabel) {
      this.legendGroup.remove(this.moreLabel as unknown as THREE.Object3D);
      this.moreLabel = null;
    }
  }
}
