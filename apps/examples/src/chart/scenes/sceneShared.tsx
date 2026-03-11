// Shared layout constants and helper components for chart demo scenes.
import type { JSX } from 'react';
import { Ambient, Directional, Lighting, TextBox } from '@brewsite/core';

export const CHART_CAM_POS: [number, number, number] = [0, 0.12, 6.6];
export const CHART_CAM_TGT: [number, number, number] = [0, 0.08, 0];
export const CHART_CAM_FOV = 42;

export const PIE_CAM_POS: [number, number, number] = [0, 0.12, 7.3];
export const PIE_CAM_TGT: [number, number, number] = [0, 0.08, 0];
export const PIE_CAM_FOV = 42;

export const TITLE_LAYOUT = { x: 0.08, y: 0.05, w: 0.48, h: 0.14 } as const;
// CHART_LAYOUT: center (0.5, 0.47) — geometry 0.40 × 0.30
export const CHART_LAYOUT = { x: 0.30, y: 0.32, w: 0.40, h: 0.30 } as const;
// PIE_LAYOUT: center (0.50, 0.48) — geometry 0.40 × 0.40
export const PIE_LAYOUT   = { x: 0.30, y: 0.28, w: 0.40, h: 0.40 } as const;
// DASH_LAYOUT: two side-by-side charts, center-left (0.26, 0.47), center-right (0.74, 0.47)
export const DASH_LAYOUT_LEFT  = { x: 0.085, y: 0.33, w: 0.35, h: 0.28 } as const;
export const DASH_LAYOUT_RIGHT = { x: 0.565, y: 0.33, w: 0.35, h: 0.28 } as const;

export const SceneLighting = (): JSX.Element => (
  <Lighting intensityScale={1.35}>
    <Ambient intensity={0.95} color="#d7e5ff" />
    <Directional intensity={1.1} color="#edf4ff" position={[-5, 7, 10]} />
    <Directional intensity={0.72} color="#59cfff" position={[6, 1, 7]} />
    <Directional intensity={0.42} color="#ffb36b" position={[-7, -1, 5]} />
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
      <span style={{ fontSize: '11px', letterSpacing: '0.14em', color: 'rgba(196,222,255,0.55)', textTransform: 'uppercase' }}>
        {subtitle}
      </span>
      <h2 style={{ fontSize: '26px', color: '#f6fbff', margin: '6px 0 0', lineHeight: 1.05 }}>
        {title}
      </h2>
    </div>
  </TextBox>
);
