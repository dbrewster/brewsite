// Builds and updates floor plane, axis lines, tick marks, and tick labels.

import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { ensureText, disposeText, parseHexColor } from '@brewsite/core';
import type { TextWithLayout } from '@brewsite/core';
import type { ChartAxisState, FittedMargins } from './IChartRenderer';
import type { ChartTheme } from '../../themes/types';

type TickEntry = {
  readonly value: unknown;
  readonly position: number;
};

type AxisRenderState = {
  xTicks: TickEntry[];
  yTicks: TickEntry[];
  bounds: { width: number; height: number };
  /**
   * Positive depth extent of rendered series geometry behind the axis plane (z=0).
   * The background plane is positioned just beyond this depth.
   */
  seriesDepth?: number;
  theme: ChartTheme;
  opacity: number;
  xAxis: ChartAxisState | null;
  yAxis: ChartAxisState | null;
  fontUrl?: string;
  /** Per-chart gridlines override from ChartRenderContext.gridlines. When absent, treated as null (no override). */
  gridlines?: boolean | null;
  /**
   * V2.1: Fitted margin values from computeChartLayout().
   * When present, used for axis title positioning instead of raw theme margin values.
   * When absent, falls back to legacy theme-based formula for backward compatibility.
   */
  fittedMargins?: FittedMargins;
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
  private readonly gridlineObjects: THREE.Line[] = [];

  constructor(private readonly axesGroup: THREE.Group) {}

  update(state: AxisRenderState): void {
    const { xTicks, yTicks, bounds, seriesDepth, theme, opacity, xAxis, yAxis, fontUrl, gridlines, fittedMargins } = state;
    const { width, height } = bounds;

    // Floor plane
    this.updateFloor(width, height, theme, opacity, seriesDepth ?? 0);

    // Axis lines
    this.updateAxisLines(width, height, theme, opacity);

    // Ticks + labels
    this.updateTicks(xTicks, yTicks, width, height, theme, opacity, xAxis, yAxis, fontUrl, fittedMargins);

    // Gridlines
    this.updateGridlines(yTicks, width, height, theme, opacity, xAxis, yAxis, gridlines ?? null);
  }

  private updateFloor(
    width: number,
    height: number,
    theme: ChartTheme,
    opacity: number,
    seriesDepth: number,
  ): void {
    const parsedPlane = theme.background.planeColor ? parseHexColor(theme.background.planeColor) : null;
    const floorOpacity = theme.background.planeOpacity * opacity * (parsedPlane?.alpha ?? 1);
    if (!theme.background.planeColor || floorOpacity <= 0) {
      this.removeFloorPlane();
      return;
    }

    if (!this.floorPlane) {
      // DEBT: Use ChartMaterialFactory.createFloorMaterial() instead of inline material creation
      const geo = new THREE.PlaneGeometry(width, height);
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(parsedPlane!.rgb),
        transparent: floorOpacity < 1,
        opacity: floorOpacity,
        side: THREE.FrontSide,
      });
      this.floorPlane = new THREE.Mesh(geo, mat);
      const floorZ = -(Math.max(0, seriesDepth) + 0.01);
      this.floorPlane.position.set(width / 2, height / 2, floorZ);
      this.axesGroup.add(this.floorPlane);
    } else {
      const mat = this.floorPlane.material as THREE.MeshStandardMaterial;
      mat.color.set(parsedPlane!.rgb);
      mat.opacity = floorOpacity;
      mat.transparent = floorOpacity < 1;
      const floorZ = -(Math.max(0, seriesDepth) + 0.01);
      this.floorPlane.position.set(width / 2, height / 2, floorZ);
    }
  }

  private removeFloorPlane(): void {
    if (!this.floorPlane) return;
    this.floorPlane.geometry.dispose();
    const material = this.floorPlane.material;
    if (Array.isArray(material)) { for (const entry of material) entry.dispose(); } else { material.dispose(); }
    this.axesGroup.remove(this.floorPlane);
    this.floorPlane = null;
  }

  private updateAxisLines(
    width: number,
    height: number,
    theme: ChartTheme,
    opacity: number,
  ): void {
    const parsedLine = parseHexColor(theme.axis.lineColor);
    const color = new THREE.Color(parsedLine.rgb);
    const lineOpacity = opacity * theme.axis.lineOpacity * parsedLine.alpha;

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
    fittedMargins?: FittedMargins,
  ): void {
    const tickLen = theme.axis.tickLength;
    const parsedTickLine = parseHexColor(theme.axis.lineColor);
    const color = new THREE.Color(parsedTickLine.rgb);
    const parsedLabel = parseHexColor(theme.axis.labelColor);
    const labelColor = parsedLabel.rgb;
    const labelOpacity = opacity * theme.axis.labelOpacity * parsedLabel.alpha;
    const fontSize = theme.axis.fontSize;
    const titleFontSize = theme.axis.titleFontSize ?? fontSize * 1.1;
    const tickOpacity = opacity * theme.axis.tickOpacity * parsedTickLine.alpha;
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

    // Axis title labels — V2.1: use fittedMargins for positioning when available
    const titlePad = titleFontSize * 0.5;

    if (xAxis?.label) {
      const titleLabel = this.ensureAxisTitle('x');
      const titleObject = titleLabel as unknown as THREE.Object3D;
      // V2.1: use fittedMargins.bottom for X axis title Y position; fall back to legacy formula
      const xTitleY = fittedMargins
        ? -fittedMargins.bottom + titlePad
        : -(tickLen + axisGap + fontSize * 1.8);
      titleObject.position.set(width / 2, xTitleY, AXIS_LABEL_Z_OFFSET);
      titleObject.rotation.z = 0;
      titleObject.renderOrder = 10;
      ensureText(titleLabel, xAxis.label, labelColor, titleFontSize, labelOpacity, undefined, false, {
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
      // V2.1: use fittedMargins.left for Y axis title X position; fall back to legacy formula
      const yTitleX = fittedMargins
        ? -fittedMargins.left + titlePad
        : -(tickLen + axisGap + fontSize * 2.5);
      obj.position.set(yTitleX, height / 2, AXIS_LABEL_Z_OFFSET);
      obj.rotation.z = Math.PI / 2;
      obj.renderOrder = 10;
      ensureText(titleLabel, yAxis.label, labelColor, titleFontSize, labelOpacity, undefined, false, {
        anchorX: 'center',
        anchorY: 'bottom',
        fontUrl,
      });
    } else if (this.yAxisTitle) {
      this.removeLabel(this.yAxisTitle);
      this.yAxisTitle = null;
    }
  }

  private updateGridlines(
    yTicks: TickEntry[],
    width: number,
    height: number,
    theme: ChartTheme,
    opacity: number,
    _xAxis: ChartAxisState | null,
    yAxis: ChartAxisState | null,
    gridlines: boolean | null,
  ): void {
    // V2.1: theme.gridlines?.visible is the baseline; per-chart and per-axis props override.
    const themeGridlinesVisible = theme.gridlines?.visible ?? false;
    const yAxisGridlines = yAxis?.gridlines !== false;
    // gridlines === true: explicit DSL enable. false: explicit disable. null: use theme baseline.
    const showGridlines = gridlines !== false && yAxisGridlines && (gridlines === true || themeGridlinesVisible);

    // Remove all existing gridline objects first
    for (const line of this.gridlineObjects) {
      this.axesGroup.remove(line);
      line.geometry.dispose();
      const mat = line.material;
      if (Array.isArray(mat)) { for (const m of mat) m.dispose(); } else { mat.dispose(); }
    }
    this.gridlineObjects.length = 0;

    if (!showGridlines) return;

    // V2.1: read all tokens from theme.gridlines — color fallback chain, opacity, dash support
    const parsedGrid = parseHexColor(theme.gridlines?.color ?? theme.background.gridColor ?? '#4a6080');
    const gridColor = new THREE.Color(parsedGrid.rgb);
    const gridOpacity = (theme.gridlines?.opacity ?? 0.15) * opacity * parsedGrid.alpha;
    const dashSize = theme.gridlines?.dashSize;
    const gapSize = theme.gridlines?.gapSize ?? dashSize; // default gapSize equals dashSize

    for (const tick of yTicks) {
      const y = tick.position * height;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, y, -0.005),
        new THREE.Vector3(width, y, -0.005),
      ]);

      let line: THREE.Line;
      if (dashSize) {
        // V2.1: use LineDashedMaterial for themes that specify dashSize (e.g. neonCyber)
        const mat = new THREE.LineDashedMaterial({
          color: gridColor,
          transparent: true,
          opacity: gridOpacity,
          dashSize,
          gapSize: gapSize ?? dashSize,
        });
        line = new THREE.Line(geo, mat);
        line.computeLineDistances();
      } else {
        const mat = new THREE.LineBasicMaterial({
          color: gridColor,
          transparent: true,
          opacity: gridOpacity,
        });
        line = new THREE.Line(geo, mat);
      }

      this.axesGroup.add(line);
      this.gridlineObjects.push(line);
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
    disposeText(label);
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

    for (const line of this.gridlineObjects) {
      this.axesGroup.remove(line);
      line.geometry.dispose();
      const mat = line.material;
      if (Array.isArray(mat)) { for (const m of mat) m.dispose(); } else { mat.dispose(); }
    }
    this.gridlineObjects.length = 0;

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
    this.removeFloorPlane();
  }
}
