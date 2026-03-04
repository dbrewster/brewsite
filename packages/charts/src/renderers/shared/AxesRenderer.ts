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

/**
 * Manages floor plane, axis lines, tick marks, and tick label Text objects
 * inside an axesGroup. Designed for incremental update — call update() each frame.
 */
export class AxesRenderer {
  private axisLineX: THREE.Line | null = null;
  private axisLineY: THREE.Line | null = null;
  private floorPlane: THREE.Mesh | null = null;
  private readonly tickObjects: THREE.Object3D[] = [];
  private readonly labelObjects: TextWithLayout[] = [];
  private lastThemeAxis: string | null = null;

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
    _opacity: number,
  ): void {
    if (!this.floorPlane) {
      const geo = new THREE.PlaneGeometry(width, height);
      const mat = new THREE.MeshStandardMaterial({
        color: theme.background.gridColor ? new THREE.Color(theme.background.gridColor) : 0x111111,
        transparent: true,
        opacity: 0.3,
        side: THREE.FrontSide,
      });
      this.floorPlane = new THREE.Mesh(geo, mat);
      this.floorPlane.rotation.x = -Math.PI / 2;
      this.floorPlane.position.set(width / 2, 0, 0);
      this.axesGroup.add(this.floorPlane);
    }
  }

  private updateAxisLines(
    width: number,
    height: number,
    theme: ChartTheme,
    opacity: number,
  ): void {
    const color = new THREE.Color(theme.axis.lineColor);
    const lineOpacity = opacity * 0.8;

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
    // Remove old tick objects
    for (const obj of this.tickObjects) {
      this.axesGroup.remove(obj);
      if ((obj as THREE.Line).geometry) (obj as THREE.Line).geometry.dispose();
    }
    this.tickObjects.length = 0;

    // Remove old label objects
    for (const lbl of this.labelObjects) {
      if (lbl instanceof THREE.Object3D) this.axesGroup.remove(lbl);
    }
    this.labelObjects.length = 0;

    const tickLen = theme.axis.tickLength;
    const color = new THREE.Color(theme.axis.lineColor);
    const labelColor = theme.axis.labelColor;
    const fontSize = theme.axis.fontSize;

    // X-axis ticks (along bottom)
    for (const tick of xTicks) {
      const x = tick.position * width;
      const tickGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0, 0),
        new THREE.Vector3(x, -tickLen, 0),
      ]);
      const tickMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: opacity * 0.6 });
      const tickLine = new THREE.Line(tickGeo, tickMat);
      this.axesGroup.add(tickLine);
      this.tickObjects.push(tickLine);

      // Label
      const label = new Text() as unknown as TextWithLayout;
      label.userData = {};
      (label as unknown as THREE.Object3D).position.set(x, -tickLen - fontSize * 0.6, 0);
      ensureText(
        label,
        String(tick.value),
        labelColor,
        fontSize,
        opacity,
        undefined,
        false,
        { anchorX: 'center', anchorY: 'top', fontUrl },
      );
      this.axesGroup.add(label as unknown as THREE.Object3D);
      this.labelObjects.push(label);
    }

    // Y-axis ticks (along left)
    for (const tick of yTicks) {
      const y = (tick as { position: number }).position * height;
      const tickGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, y, 0),
        new THREE.Vector3(-tickLen, y, 0),
      ]);
      const tickMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: opacity * 0.6 });
      const tickLine = new THREE.Line(tickGeo, tickMat);
      this.axesGroup.add(tickLine);
      this.tickObjects.push(tickLine);

      // Label
      const label = new Text() as unknown as TextWithLayout;
      label.userData = {};
      (label as unknown as THREE.Object3D).position.set(-tickLen - fontSize * 0.3, y, 0);
      ensureText(
        label,
        String(tick.value),
        labelColor,
        fontSize,
        opacity,
        undefined,
        false,
        { anchorX: 'right', anchorY: 'middle', fontUrl },
      );
      this.axesGroup.add(label as unknown as THREE.Object3D);
      this.labelObjects.push(label);
    }

    // Axis title labels
    if (xAxis?.label) {
      const titleLabel = new Text() as unknown as TextWithLayout;
      titleLabel.userData = {};
      (titleLabel as unknown as THREE.Object3D).position.set(width / 2, -tickLen - fontSize * 1.8, 0);
      ensureText(titleLabel, xAxis.label, labelColor, fontSize * 1.1, opacity, undefined, false, {
        anchorX: 'center',
        anchorY: 'top',
        fontUrl,
      });
      this.axesGroup.add(titleLabel as unknown as THREE.Object3D);
      this.labelObjects.push(titleLabel);
    }

    if (yAxis?.label) {
      const titleLabel = new Text() as unknown as TextWithLayout;
      titleLabel.userData = {};
      const obj = titleLabel as unknown as THREE.Object3D;
      obj.position.set(-tickLen - fontSize * 2.5, height / 2, 0);
      obj.rotation.z = Math.PI / 2;
      ensureText(titleLabel, yAxis.label, labelColor, fontSize * 1.1, opacity, undefined, false, {
        anchorX: 'center',
        anchorY: 'bottom',
        fontUrl,
      });
      this.axesGroup.add(obj);
      this.labelObjects.push(titleLabel);
    }

    this.lastThemeAxis = `${theme.name}|${opacity}`;
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

    for (const lbl of this.labelObjects) {
      if (lbl instanceof THREE.Object3D) {
        this.axesGroup.remove(lbl);
      }
    }
    this.labelObjects.length = 0;

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
    this.lastThemeAxis = null;
  }
}
