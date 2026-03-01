// ChartTooltipOverlay — projects ChartHoverInfo to screen and renders a tooltip div.

import React, { useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import type { ChartHoverInfo } from '../elements/chart/ChartWidget';
import type { ChartWidget } from '../elements/chart/ChartWidget';

export type ChartTooltipOverlayProps = {
  /** The ChartWidget instance to subscribe to hover events on. */
  widget: ChartWidget;
  /** The Three.js camera used for world→screen projection. */
  camera?: THREE.Camera;
  /** The renderer's DOM element (used for bounding rect). */
  domElement?: HTMLElement;
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
 * Renders a floating tooltip over the canvas when a chart element is hovered.
 * Projects the 3D hit point to 2D screen coordinates using the Three.js camera.
 *
 * Usage: place inside the same React tree as the EngineProvider.
 */
export function ChartTooltipOverlay({
  widget,
  camera,
  domElement,
  renderContent = defaultRenderContent,
  className,
}: ChartTooltipOverlayProps): React.ReactElement | null {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const project = useCallback(
    (info: ChartHoverInfo | null): void => {
      if (!info || !camera || !domElement) {
        setTooltip(null);
        return;
      }

      const rect = domElement.getBoundingClientRect();
      const point = new THREE.Vector3(info.point[0], info.point[1], info.point[2]);
      point.project(camera);

      const x = ((point.x + 1) / 2) * rect.width + rect.left;
      const y = ((-point.y + 1) / 2) * rect.height + rect.top;

      setTooltip({ info, x, y });
    },
    [camera, domElement],
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
        position: 'fixed',
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
