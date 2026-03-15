// Shared layout constants and helper components for chart demo scenes.
import { createContext, useContext } from 'react';
import type { JSX, ReactNode } from 'react';
import { Ambient, Directional, Lighting, TextBox } from '@brewsite/core';
import type { ChartTheme } from '@brewsite/charts';
import { bundles } from '@brewsite/themes';

// ─── Chart demo theme context ─────────────────────────────────────────────────

const ChartDemoThemeContext = createContext<ChartTheme | null>(null);

/** Provides the current ChartTheme to all chart demo scenes. */
export const ChartDemoThemeProvider = ({ value, children }: { value: ChartTheme; children: ReactNode }): JSX.Element => (
  <ChartDemoThemeContext.Provider value={value}>{children}</ChartDemoThemeContext.Provider>
);

/**
 * Returns the current ChartTheme from ChartDemoThemeContext.
 * Falls back to CHART_THEME_PAIRS['lightCanvas']['light'] when no provider is present
 * (e.g., in tests that render scene components in isolation).
 */
export function useDemoChartTheme(): ChartTheme {
  return useContext(ChartDemoThemeContext) ?? bundles.lightCanvas.chart.light;
}

export const CHART_CAM_POS: [number, number, number] = [0, 1.5, 6.6];
export const CHART_CAM_TGT: [number, number, number] = [0, 0.08, 0];
export const CHART_CAM_FOV = 42;

export const PIE_CAM_POS: [number, number, number] = [0, 2.12, 7.3];
export const PIE_CAM_TGT: [number, number, number] = [0, 0.08, 0];
export const PIE_CAM_FOV = 42;

export const TITLE_LAYOUT = { x: 0.05, y: 0.03, w: 0.52, h: 0.11 } as const;
// CHART_LAYOUT: center (0.50, 0.42) — geometry 0.62 × 0.52 (fills most of the canvas)
export const CHART_LAYOUT = { x: 0.19, y: 0.16, w: 0.62, h: 0.52 } as const;
// PIE_LAYOUT: center (0.50, 0.41) — tall square area for pie/donut geometry
export const PIE_LAYOUT   = { x: 0.21, y: 0.10, w: 0.58, h: 0.62 } as const;
// DASH_LAYOUT: two side-by-side charts filling most of the canvas
export const DASH_LAYOUT_LEFT  = { x: 0.04, y: 0.28, w: 0.45, h: 0.43 } as const;
export const DASH_LAYOUT_RIGHT = { x: 0.53, y: 0.28, w: 0.45, h: 0.43 } as const;

export const SceneLighting = (): JSX.Element => (
  <Lighting intensityScale={1.35}>
    <Ambient intensity={0.95} color="#d7e5ff" />
    <Directional intensity={1.1} color="#edf4ff" position={[0, 2, 10]} />
    <Directional intensity={0.72} color="#59cfff" position={[0, .5, 7]} />
  </Lighting>
);

export const NeonLighting = (): JSX.Element => (
  <Lighting intensityScale={1.2}>
    <Ambient intensity={0.7} color="#c0d8ff" />
    <Directional intensity={1.3} color="#7af0ff" position={[-4, 6, 8]} />
    <Directional intensity={0.9} color="#ff38ff" position={[5, 2, 6]} />
    <Directional intensity={0.5} color="#00ffaa" position={[-6, -2, 5]} />
  </Lighting>
);

interface SceneTitleBoxProps {
  id: string;
  subtitle?: string;
  title: string;
}

export const SceneTitleBox = ({ id, subtitle = 'Chart Demo', title }: SceneTitleBoxProps): JSX.Element => (
  <TextBox key={id} id={id} x={TITLE_LAYOUT.x} y={TITLE_LAYOUT.y} w={TITLE_LAYOUT.w} h={TITLE_LAYOUT.h}>
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', padding: '0 8px' }}>
      <span style={{ fontSize: '11px', letterSpacing: '0.14em', color: 'var(--brewsite-text-secondary)', textTransform: 'uppercase' }}>
        {subtitle}
      </span>
      <h2 style={{ fontSize: '26px', color: 'var(--brewsite-text-primary)', margin: '6px 0 0', lineHeight: 1.05 }}>
        {title}
      </h2>
    </div>
  </TextBox>
);
