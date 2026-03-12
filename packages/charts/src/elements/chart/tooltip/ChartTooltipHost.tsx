// ChartTooltipHost — zero-prop global overlay component for chart tooltips.

import React, { useEffect, useRef } from 'react';
import { useSyncExternalStore } from 'react';
import { format as d3format } from 'd3-format';
import { chartTooltipStore, ChartTooltipStoreImpl } from './ChartTooltipStore';
import type { ChartTooltipEntry } from './ChartTooltipStore';
import type { ChartTooltipTokens } from '../../../themes/types';
import type { ChartHitInfo, ChartHitMeta } from '../../../renderers/shared/IChartRenderer';

/** Hardcoded darkGlass fallback constants — used when theme.tooltip is absent. */
const DEFAULT_TOOLTIP_TOKENS: ChartTooltipTokens = {
  background:   'rgba(28,16,10,0.92)',
  blur:         '8px',
  borderColor:  'rgba(227,106,46,0.3)',
  borderRadius: '6px',
  valueColor:   '#F0E4DA',
  labelColor:   'rgba(240,228,218,0.65)',
  fontSize:     12,
  shadow:       '0 4px 16px rgba(0,0,0,0.5)',
  padding:      '8px 12px',
  maxWidth:     220,
  offsetX:      12,
  offsetY:      -12,
};

/** Edge detection margin in px — tooltip flips when anchor is within this distance from edge. */
const EDGE_MARGIN_PX = 16;

/** Estimated tooltip height for bottom-edge flip calculation. */
const ESTIMATED_TOOLTIP_HEIGHT_PX = 110;

/** Formats a value using d3-format if a format string is provided, falls back to String(). */
function formatValue(v: unknown, formatStr?: string): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' && formatStr) {
    try {
      return d3format(formatStr)(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function DefaultTooltipContent({
  info,
  tokens,
  format,
}: {
  info: ChartHitInfo;
  tokens: ChartTooltipTokens;
  /** d3-format string from ChartTooltipEntry.format. */
  format?: string;
}): React.ReactElement {
  const { meta, row } = info;
  const labelStyle: React.CSSProperties = { color: tokens.labelColor, fontSize: tokens.fontSize * 0.9 };
  const valueStyle: React.CSSProperties = { color: tokens.valueColor, fontWeight: 700, fontSize: tokens.fontSize * 1.2 };
  const secondaryStyle: React.CSSProperties = { color: tokens.labelColor, fontSize: tokens.fontSize * 0.85, marginTop: 2 };

  if (!meta) {
    // Fallback: raw row display (same as deprecated ChartTooltipOverlay)
    return (
      <div>
        {Object.entries(row).slice(0, 4).map(([k, v]) => (
          <div key={k}>
            <span style={labelStyle}>{k}: </span>
            <span style={valueStyle}>{String(v)}</span>
          </div>
        ))}
      </div>
    );
  }

  return renderMetaContent(meta, row, labelStyle, valueStyle, secondaryStyle, format);
}

function renderMetaContent(
  meta: ChartHitMeta,
  _row: Record<string, unknown>,
  labelStyle: React.CSSProperties,
  valueStyle: React.CSSProperties,
  secondaryStyle: React.CSSProperties,
  format?: string,
): React.ReactElement {
  switch (meta.kind) {
    case 'bar':
      return (
        <div>
          <div style={labelStyle}>{meta.seriesLabel}</div>
          <div style={valueStyle}>{formatValue(meta.segmentValue, format)}</div>
          {meta.stackTotal !== undefined && (
            <div style={secondaryStyle}>Stack total: {formatValue(meta.stackTotal, format)}</div>
          )}
        </div>
      );
    case 'line':
      return (
        <div>
          <div style={labelStyle}>{meta.seriesLabel}</div>
          <div style={valueStyle}>{formatValue(meta.yValue, format)}</div>
        </div>
      );
    case 'area':
      return (
        <div>
          <div style={labelStyle}>{meta.seriesLabel}</div>
          <div style={valueStyle}>{formatValue(meta.stackValue ?? meta.yValue, format)}</div>
        </div>
      );
    case 'scatter':
      return (
        <div>
          <div style={labelStyle}>X: <span style={valueStyle}>{formatValue(meta.xValue, format)}</span></div>
          {meta.sizeValue !== undefined && <div style={secondaryStyle}>Size: {formatValue(meta.sizeValue, format)}</div>}
          {meta.colorValue !== undefined && <div style={secondaryStyle}>Color: {formatValue(meta.colorValue)}</div>}
        </div>
      );
    case 'pie':
      return (
        <div>
          <div style={labelStyle}>{meta.sliceName}</div>
          <div style={valueStyle}>{meta.percentage.toFixed(1)}%</div>
          <div style={secondaryStyle}>Total: {formatValue(meta.total, format)}</div>
        </div>
      );
    case 'heatmap':
      return (
        <div>
          <div style={labelStyle}>{meta.columnLabel} / {meta.rowLabel}</div>
          <div style={valueStyle}>{(meta.intensity * 100).toFixed(0)}%</div>
        </div>
      );
  }
}

function TooltipCard({
  entry,
  containerW,
  containerH,
  store,
}: {
  entry: ChartTooltipEntry;
  containerW: number;
  containerH: number;
  store: ChartTooltipStoreImpl;
}): React.ReactElement {
  const tokens = entry.tooltipTokens ?? DEFAULT_TOOLTIP_TOKENS;
  const runtimeConfig = store.getRuntimeConfig(entry.widgetId);
  const content = runtimeConfig?.renderContent
    ? runtimeConfig.renderContent(entry.info)
    : <DefaultTooltipContent info={entry.info} tokens={tokens} format={entry.format} />;

  // Edge-flip logic
  const flipX = entry.x + tokens.maxWidth + tokens.offsetX > containerW - EDGE_MARGIN_PX;
  const flipY = entry.y - tokens.offsetY + ESTIMATED_TOOLTIP_HEIGHT_PX > containerH - EDGE_MARGIN_PX;

  const left = flipX
    ? entry.x - tokens.maxWidth - tokens.offsetX
    : entry.x + tokens.offsetX;
  const top = flipY
    ? entry.y - ESTIMATED_TOOLTIP_HEIGHT_PX + tokens.offsetY
    : entry.y + tokens.offsetY;

  const backdropFilter = tokens.blur ? `blur(${tokens.blur})` : undefined;

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        maxWidth: tokens.maxWidth,
        background: tokens.background,
        border: `1px solid ${tokens.borderColor}`,
        borderRadius: tokens.borderRadius,
        boxShadow: tokens.shadow,
        backdropFilter,
        WebkitBackdropFilter: backdropFilter,
        padding: tokens.padding,
        fontFamily: tokens.fontFamily ?? 'inherit',
        fontSize: tokens.fontSize,
        pointerEvents: 'none',
        zIndex: 9999,
        opacity: 1,
        animation: 'chartTooltipFadeIn 120ms ease-out',
      }}
    >
      {content}
    </div>
  );
}

/**
 * Global tooltip overlay component for all charts in the engine.
 * Place once inside EngineOverlayHost.
 *
 * The container div is always mounted so containerRef.current is populated
 * before any TooltipCard needs edge-flip dimensions.
 *
 * @param _store  Test-only injection. Do not pass in production.
 *
 * @example
 * <EngineOverlayHost>
 *   <ChartTooltipHost />
 * </EngineOverlayHost>
 */
export function ChartTooltipHost({ _store = chartTooltipStore }: { _store?: ChartTooltipStoreImpl } = {}): React.ReactElement {
  const entry = useSyncExternalStore(
    _store.subscribe.bind(_store),
    _store.getSnapshot.bind(_store),
  );
  const containerRef = useRef<HTMLDivElement>(null);

  // Register presence with the store for dev-mode warning tracking
  useEffect(() => {
    return _store.registerHost();
  }, [_store]);

  // Inject fade-in keyframe once on mount — not on every render
  useEffect(() => {
    const KEYFRAME_ID = 'chart-tooltip-keyframes';
    if (!document.getElementById(KEYFRAME_ID)) {
      const style = document.createElement('style');
      style.id = KEYFRAME_ID;
      style.textContent = [
        '@keyframes chartTooltipFadeIn {',
        '  from { opacity: 0; transform: translateY(4px); }',
        '  to   { opacity: 1; transform: translateY(0); }',
        '}',
      ].join(' ');
      document.head.appendChild(style);
      return () => { style.remove(); };
    }
    return undefined;
  }, []);

  // Container is ALWAYS mounted — containerRef.current is valid before first tooltip render
  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}
    >
      {entry && (
        <TooltipCard
          entry={entry}
          containerW={containerRef.current?.offsetWidth ?? 0}
          containerH={containerRef.current?.offsetHeight ?? 0}
          store={_store}
        />
      )}
    </div>
  );
}
