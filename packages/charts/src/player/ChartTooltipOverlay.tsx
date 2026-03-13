// ChartTooltipOverlay — projects ChartHoverInfo to NVS sub-region pixel coordinates and renders a tooltip div.

import React, { useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import type { NVSRect } from '@brewsite/core';
import type { ChartHoverInfo } from '../elements/chart/ChartWidget';
import type { ChartWidget } from '../elements/chart/ChartWidget';

/**
 * @deprecated Since v2.2. Use `<ChartTooltip>` inside the chart DSL and
 * `<ChartTooltipHost>` inside EngineOverlayHost instead.
 * This component will be **removed in the next minor version**.
 *
 * Migration:
 * ```tsx
 * // Before:
 * <ChartTooltipOverlay widget={someWidget} nvsBounds={{ x: 0, y: 0, w: 1, h: 1 }} />
 * // After:
 * // In DSL:  <BarChart id="revenue" interactive><ChartTooltip /></BarChart>
 * // In overlay: <EngineOverlayHost><ChartTooltipHost /></EngineOverlayHost>
 * ```
 */
export type ChartTooltipOverlayProps = {
  /** The ChartWidget instance to subscribe to hover events on. */
  widget: ChartWidget;
  /**
   * NVS bounds of the chart within the AR-locked container.
   * Must match the nvsBounds declared in the Chart DSL.
   * Used to project the 3D hit point to absolute pixel offsets
   * within EngineOverlayHost.
   */
  nvsBounds: NVSRect;
  /** Custom render function for the tooltip content. */
  renderContent?: (info: ChartHoverInfo) => React.ReactNode;
  /** Extra CSS class name applied to the tooltip container. */
  className?: string;
};

type TooltipState = {
  info: ChartHoverInfo;
  x: number;
  y: number;
};

import { projectNdcToNvsPixels } from '../elements/chart/tooltip/projectUtils';

function defaultRenderContent(info: ChartHoverInfo): React.ReactNode {
  const entries = Object.entries(info.row).slice(0, 4);
  return (
    <div style={{ padding: '6px 10px', fontSize: '12px', lineHeight: 1.5 }}>
      {entries.map(([k, v]) => (
        <div key={k}>
          <span style={{ opacity: 0.7 }}>{k}: </span>
          <span style={{ fontWeight: 600 }}>{String(v)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * @deprecated Since v2.2. Use `<ChartTooltip>` inside the chart DSL and
 * `<ChartTooltipHost>` inside EngineOverlayHost instead.
 * This component will be **removed in the next minor version**.
 *
 * Migration:
 * ```tsx
 * // Before:
 * <ChartTooltipOverlay widget={someWidget} nvsBounds={{ x: 0, y: 0, w: 1, h: 1 }} />
 * // After:
 * // In DSL:  <BarChart id="revenue" interactive><ChartTooltip /></BarChart>
 * // In overlay: <EngineOverlayHost><ChartTooltipHost /></EngineOverlayHost>
 * ```
 *
 * Renders a floating tooltip inside EngineOverlayHost when a chart element is hovered.
 * Projects the 3D hit point to 2D pixel coordinates within the NVS sub-region
 * using the widget's camera and container size.
 *
 * @see ChartTooltip
 * @see ChartTooltipHost
 */
export function ChartTooltipOverlay({
  widget,
  nvsBounds,
  renderContent = defaultRenderContent,
  className,
}: ChartTooltipOverlayProps): React.ReactElement | null {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const project = useCallback(
    (info: ChartHoverInfo | null): void => {
      if (!info) { setTooltip(null); return; }
      const camera = widget.getCamera();
      const containerSize = widget.getContainerSize();
      if (!camera || !containerSize) { setTooltip(null); return; }

      // Project 3D world position to NDC.
      const point = new THREE.Vector3(info.point[0], info.point[1], info.point[2]);
      point.project(camera); // NDC in [-1, 1] x [-1, 1]

      // Map NDC into the NVS sub-region pixel footprint within the AR container.
      const { x, y } = projectNdcToNvsPixels(
        point.x,
        point.y,
        containerSize.width,
        containerSize.height,
        nvsBounds,
      );

      setTooltip({ info, x, y });
    },
    [widget, nvsBounds],
  );

  useEffect(() => {
    widget.onHover = project;
    return () => {
      widget.onHover = undefined;
    };
  }, [widget, project]);

  if (!tooltip) return null;

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        left: tooltip.x + 12,
        top: tooltip.y - 12,
        background: 'rgba(15, 23, 42, 0.92)',
        border: '1px solid rgba(100, 116, 139, 0.4)',
        borderRadius: '6px',
        color: '#e2e8f0',
        pointerEvents: 'none',
        zIndex: 9999,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(8px)',
        minWidth: '120px',
      }}
    >
      {renderContent(tooltip.info)}
    </div>
  );
}
