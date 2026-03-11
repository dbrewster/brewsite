// Builds and updates floor plane, axis lines, tick marks, and tick labels.

import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { ensureText } from '@brewsite/core';
import type { TextWithLayout } from '@brewsite/core';
import type { ChartAxisState } from './IChartRenderer';
import type { ChartTheme } from '../../themes/types';

type TickEntry = {
  readonly value: unknown;
  readonly position: number;
};

type AxisRenderState = {
  xTicks: TickEntry[];
  yTicks: TickEntry[];
  bounds: { width: number; height: number };
  theme: ChartTheme;
  opacity: number;
  xAxis: ChartAxisState | null;
  yAxis: ChartAxisState | null;
  fontUrl?: string;
};

const AXIS_LABEL_Z_OFFSET = 0.01;

/**
 * Manages floor plane, axis lines, tick marks, and tick label Text objects
 * inside an axesGroup. Designed for incremental update — call update() each frame.
 */
export class AxesRenderer {
  private axisLineX: THREE.Line | null = null;
  private axisLineY: THREE.Line | null = null;
  private floorPlane: THREE.Mesh | null = null;
  private readonly tickObjects: THREE.Object3D[] = [];
  private readonly xTickLabels: TextWithLayout[] = [];
  private readonly yTickLabels: TextWithLayout[] = [];
  private xAxisTitle: TextWithLayout | null = null;
  private yAxisTitle: TextWithLayout | null = null;

  constructor(private readonly axesGroup: THREE.Group) {}

  update(state: AxisRenderState): void {
    const { xTicks, yTicks, bounds, theme, opacity, xAxis, yAxis, fontUrl } = state;
    const { width, height } = bounds;

    // Floor plane
    this.updateFloor(width, height, theme, opacity);

    // Axis lines
    this.updateAxisLines(width, height, theme, opacity);

    // Ticks + labels
    this.updateTicks(xTicks, yTicks, width, height, theme, opacity, xAxis, yAxis, fontUrl);
  }

  private updateFloor(
    width: number,
    height: number,
    theme: ChartTheme,
    opacity: number,
  ): void {
    if (!theme.background.planeColor) {
      if (this.floorPlane) {
        this.floorPlane.geometry.dispose();
        const material = this.floorPlane.material;
        if (Array.isArray(material)) { for (const entry of material) entry.dispose(); } else { material.dispose(); }
        this.axesGroup.remove(this.floorPlane);
        this.floorPlane = null;
      }
      return;
    }

    if (!this.floorPlane) {
      const geo = new THREE.PlaneGeometry(width, height);
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(theme.background.planeColor),
        transparent: theme.background.planeOpacity * opacity < 1,
        opacity: theme.background.planeOpacity * opacity,
        side: THREE.FrontSide,
      });
      this.floorPlane = new THREE.Mesh(geo, mat);
      this.floorPlane.position.set(width / 2, height / 2, -0.01);
      this.axesGroup.add(this.floorPlane);
    } else {
      const mat = this.floorPlane.material as THREE.MeshStandardMaterial;
      mat.color.set(theme.background.planeColor);
      mat.opacity = theme.background.planeOpacity * opacity;
      mat.transparent = theme.background.planeOpacity * opacity < 1;
    }
  }

  private updateAxisLines(
    width: number,
    height: number,
    theme: ChartTheme,
    opacity: number,
  ): void {
    const color = new THREE.Color(theme.axis.lineColor);
    const lineOpacity = opacity * theme.axis.lineOpacity;

    if (!this.axisLineX) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(width, 0, 0),
      ]);
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: lineOpacity });
      this.axisLineX = new THREE.Line(geo, mat);
      this.axesGroup.add(this.axisLineX);
    } else {
      (this.axisLineX.material as THREE.LineBasicMaterial).color.set(color);
      (this.axisLineX.material as THREE.LineBasicMaterial).opacity = lineOpacity;
    }

    if (!this.axisLineY) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, height, 0),
      ]);
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: lineOpacity });
      this.axisLineY = new THREE.Line(geo, mat);
      this.axesGroup.add(this.axisLineY);
    } else {
      (this.axisLineY.material as THREE.LineBasicMaterial).color.set(color);
      (this.axisLineY.material as THREE.LineBasicMaterial).opacity = lineOpacity;
    }
  }

  private updateTicks(
    xTicks: TickEntry[],
    yTicks: TickEntry[],
    width: number,
    height: number,
    theme: ChartTheme,
    opacity: number,
    xAxis: ChartAxisState | null,
    yAxis: ChartAxisState | null,
    fontUrl?: string,
  ): void {
    const tickLen = theme.axis.tickLength;
    const color = new THREE.Color(theme.axis.lineColor);
    const labelColor = theme.axis.labelColor;
    const labelOpacity = opacity * theme.axis.labelOpacity;
    const fontSize = theme.axis.fontSize;
    const tickOpacity = opacity * theme.axis.tickOpacity;
    const axisGap = theme.axis.gap;

    this.syncTickObjects(xTicks.length + yTicks.length, color, tickOpacity);
    this.syncLabelArray(this.xTickLabels, xTicks.length);
    this.syncLabelArray(this.yTickLabels, yTicks.length);

    for (let i = 0; i < xTicks.length; i++) {
      const tick = xTicks[i]!;
      const x = tick.position * width;
      this.updateTickLine(this.tickObjects[i] as THREE.Line, [
        new THREE.Vector3(x, 0, 0),
        new THREE.Vector3(x, -tickLen, 0),
      ], color, tickOpacity);

      const label = this.xTickLabels[i]!;
      const labelObject = label as unknown as THREE.Object3D;
      labelObject.position.set(x, -tickLen - axisGap - fontSize * 0.6, AXIS_LABEL_Z_OFFSET);
      labelObject.renderOrder = 10;
      ensureText(label, String(tick.value), labelColor, fontSize, labelOpacity, undefined, false, {
        anchorX: 'center',
        anchorY: 'top',
        fontUrl,
      });
    }

    for (let i = 0; i < yTicks.length; i++) {
      const tick = yTicks[i]!;
      const y = tick.position * height;
      this.updateTickLine(this.tickObjects[xTicks.length + i] as THREE.Line, [
        new THREE.Vector3(0, y, 0),
        new THREE.Vector3(-tickLen, y, 0),
      ], color, tickOpacity);

      const label = this.yTickLabels[i]!;
      const labelObject = label as unknown as THREE.Object3D;
      labelObject.position.set(-tickLen - axisGap - fontSize * 0.3, y, AXIS_LABEL_Z_OFFSET);
      labelObject.renderOrder = 10;
      ensureText(label, String(tick.value), labelColor, fontSize, labelOpacity, undefined, false, {
        anchorX: 'right',
        anchorY: 'middle',
        fontUrl,
      });
    }

    // Axis title labels
    if (xAxis?.label) {
      const titleLabel = this.ensureAxisTitle('x');
      const titleObject = titleLabel as unknown as THREE.Object3D;
      titleObject.position.set(width / 2, -tickLen - axisGap - fontSize * 1.8, AXIS_LABEL_Z_OFFSET);
      titleObject.rotation.z = 0;
      titleObject.renderOrder = 10;
      ensureText(titleLabel, xAxis.label, labelColor, fontSize * 1.1, labelOpacity, undefined, false, {
        anchorX: 'center',
        anchorY: 'top',
        fontUrl,
      });
    } else if (this.xAxisTitle) {
      this.removeLabel(this.xAxisTitle);
      this.xAxisTitle = null;
    }

    if (yAxis?.label) {
      const titleLabel = this.ensureAxisTitle('y');
      const obj = titleLabel as unknown as THREE.Object3D;
      obj.position.set(-tickLen - axisGap - fontSize * 2.5, height / 2, AXIS_LABEL_Z_OFFSET);
      obj.rotation.z = Math.PI / 2;
      obj.renderOrder = 10;
      ensureText(titleLabel, yAxis.label, labelColor, fontSize * 1.1, labelOpacity, undefined, false, {
        anchorX: 'center',
        anchorY: 'bottom',
        fontUrl,
      });
    } else if (this.yAxisTitle) {
      this.removeLabel(this.yAxisTitle);
      this.yAxisTitle = null;
    }
  }

  private syncTickObjects(count: number, color: THREE.Color, opacity: number): void {
    while (this.tickObjects.length > count) {
      const obj = this.tickObjects.pop() as THREE.Line | undefined;
      if (!obj) break;
      this.axesGroup.remove(obj);
      obj.geometry.dispose();
      const material = obj.material;
      if (Array.isArray(material)) { for (const entry of material) entry.dispose(); } else { material.dispose(); }
    }

    while (this.tickObjects.length < count) {
      const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
      const line = new THREE.Line(new THREE.BufferGeometry(), material);
      this.axesGroup.add(line);
      this.tickObjects.push(line);
    }
  }

  private syncLabelArray(target: TextWithLayout[], count: number): void {
    while (target.length > count) {
      const label = target.pop();
      if (label) this.removeLabel(label);
    }

    while (target.length < count) {
      const label = new Text() as unknown as TextWithLayout;
      label.userData = {};
      this.axesGroup.add(label as unknown as THREE.Object3D);
      target.push(label);
    }
  }

  private updateTickLine(
    line: THREE.Line,
    points: [THREE.Vector3, THREE.Vector3],
    color: THREE.Color,
    opacity: number,
  ): void {
    line.geometry.dispose();
    line.geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = line.material as THREE.LineBasicMaterial;
    material.color.set(color);
    material.opacity = opacity;
    material.transparent = opacity < 1;
  }

  private ensureAxisTitle(axis: 'x' | 'y'): TextWithLayout {
    if (axis === 'x') {
      if (!this.xAxisTitle) {
        this.xAxisTitle = new Text() as unknown as TextWithLayout;
        this.xAxisTitle.userData = {};
        this.axesGroup.add(this.xAxisTitle as unknown as THREE.Object3D);
      }
      return this.xAxisTitle;
    }

    if (!this.yAxisTitle) {
      this.yAxisTitle = new Text() as unknown as TextWithLayout;
      this.yAxisTitle.userData = {};
      this.axesGroup.add(this.yAxisTitle as unknown as THREE.Object3D);
    }
    return this.yAxisTitle;
  }

  private removeLabel(label: TextWithLayout): void {
    if (label instanceof THREE.Object3D) {
      this.axesGroup.remove(label);
    }
  }

  dispose(): void {
    for (const obj of this.tickObjects) {
      this.axesGroup.remove(obj);
      const line = obj as THREE.Line;
      if (line.geometry) line.geometry.dispose();
      if (line.material) {
        const mat = line.material;
        if (Array.isArray(mat)) { for (const m of mat) m.dispose(); } else { mat.dispose(); }
      }
    }
    this.tickObjects.length = 0;

    for (const label of this.xTickLabels) this.removeLabel(label);
    for (const label of this.yTickLabels) this.removeLabel(label);
    this.xTickLabels.length = 0;
    this.yTickLabels.length = 0;
    if (this.xAxisTitle) this.removeLabel(this.xAxisTitle);
    if (this.yAxisTitle) this.removeLabel(this.yAxisTitle);
    this.xAxisTitle = null;
    this.yAxisTitle = null;

    if (this.axisLineX) {
      this.axisLineX.geometry.dispose();
      const xMat = this.axisLineX.material;
      if (Array.isArray(xMat)) { for (const m of xMat) m.dispose(); } else { xMat.dispose(); }
      this.axesGroup.remove(this.axisLineX);
      this.axisLineX = null;
    }
    if (this.axisLineY) {
      this.axisLineY.geometry.dispose();
      const yMat = this.axisLineY.material;
      if (Array.isArray(yMat)) { for (const m of yMat) m.dispose(); } else { yMat.dispose(); }
      this.axesGroup.remove(this.axisLineY);
      this.axisLineY = null;
    }
    if (this.floorPlane) {
      this.floorPlane.geometry.dispose();
      const fpMat = this.floorPlane.material;
      if (Array.isArray(fpMat)) { for (const m of fpMat) m.dispose(); } else { fpMat.dispose(); }
      this.axesGroup.remove(this.floorPlane);
      this.floorPlane = null;
    }
  }
}
