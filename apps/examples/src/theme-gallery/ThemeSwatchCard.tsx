// Self-contained card component displaying visual tokens for a single ChartTheme or DiagramTheme variant.
import type { JSX } from 'react';

export type ThemeSwatchCardProps = {
  /** Display label, e.g. "darkGlass / dark" */
  label: string;
  /** CSS color for the card background (from ChartTheme.background.planeColor) */
  backgroundColor: string;
  /** 8 accent hex colors (from ChartTheme.series[].color) */
  palette: readonly string[];
  /** Projection beam hex color (from ChartTheme.projection.color) */
  projectionColor: string;
  /** Tooltip border CSS color (from ChartTheme.tooltip.borderColor) */
  tooltipBorderColor: string;
  /** Primary text color for labels on the card */
  textColor: string;
};

export function ThemeSwatchCard({
  label, backgroundColor, palette, projectionColor, tooltipBorderColor, textColor,
}: ThemeSwatchCardProps): JSX.Element {
  return (
    <div style={{
      backgroundColor,
      border: `1px solid ${tooltipBorderColor}`,
      borderRadius: 6,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      minWidth: 200,
    }}>
      <div style={{ color: textColor, fontSize: 11, fontFamily: 'system-ui', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {palette.map((color, i) => (
          <div key={i} style={{
            width: 16, height: 16, borderRadius: 3,
            backgroundColor: color, flexShrink: 0,
          }} />
        ))}
      </div>
      <div style={{
        height: 4, borderRadius: 2,
        backgroundColor: projectionColor,
        opacity: 0.85,
      }} />
    </div>
  );
}
