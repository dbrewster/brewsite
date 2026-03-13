// Scene 7: All Input Maps — scope="window", every map type, all modifier combos,
// multi-step carousel and scene navigation, mixed chart carousel.
import type { JSX } from 'react';
import {
  Action,
  Ambient,
  Camera,
  Directional,
  Floor,
  InputController,
  KeyMap,
  Lighting,
  PinchMap,
  PointerMap,
  ProgressManager,
  Scene,
  Spotlight,
  SpotlightRig,
  TextBox,
  View,
  ViewLayout,
  WheelMap,
  type OrbitFn,
} from '@brewsite/core';
import {
  BarChart,
  ChartAxis,
  ChartData,
  ChartSeries,
  LineChart,
} from '@brewsite/charts';
import { pk } from '../platformKeys';

const CAM_POS: [number, number, number] = [0, 1.5, 9];
const CAM_TGT: [number, number, number] = [0, 0, 0];
const LAYOUT_ID = 'all-maps-carousel';

// ─── Spotlights (seeded, stable) ──────────────────────────────────────────────

const seeded = (seed: number) => {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
};
const rng = seeded(99);

const randColor = (): string => {
  const h = rng() * 360;
  const s = 70 + rng() * 30;
  const l = 50 + rng() * 20;
  const a = s / 100 * Math.min(l / 100, 1 - l / 100);
  const f = (n: number): string => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

type SpotlightDef = Pick<import('@brewsite/core').SpotlightProps, 'color' | 'intensity' | 'angle' | 'orbit'>;

const spotlights: SpotlightDef[] = Array.from({ length: 4 }, () => {
  const fX = 0.2 + rng() * 0.6, fY = 0.25 + rng() * 0.5, fZ = 0.15 + rng() * 0.4;
  const aX = 3 + rng() * 5, aY = 2 + rng() * 3, aZ = 1 + rng() * 3;
  const oY = 1 + rng() * 3;
  const pX = rng() * Math.PI * 2, pY = rng() * Math.PI * 2, pZ = rng() * Math.PI * 2;
  return {
    color: randColor(),
    intensity: 55 + rng() * 45,
    angle: Math.PI / 28 + rng() * Math.PI / 10,
    orbit: ((t: number): [number, number, number] => [
      Math.sin(t * fX + pX) * aX,
      Math.sin(t * fY + pY) * aY + oY,
      Math.cos(t * fZ + pZ) * aZ,
    ]) as OrbitFn,
  };
});

// ─── Chart data (5 views, mix bar + line) ────────────────────────────────────

const amData1 = [
  { product: 'Core', revenue: 84 },
  { product: 'Pro', revenue: 62 },
  { product: 'Team', revenue: 91 },
  { product: 'Ent', revenue: 110 },
];

const amData2 = [
  { month: 'Q1', retention: 72 },
  { month: 'Q2', retention: 78 },
  { month: 'Q3', retention: 85 },
  { month: 'Q4', retention: 90 },
];

const amData3 = [
  { layer: 'Network', errors: 8 },
  { layer: 'Service', errors: 14 },
  { layer: 'App', errors: 6 },
  { layer: 'DB', errors: 3 },
];

const amData4 = [
  { sprint: 'S1', velocity: 42 },
  { sprint: 'S2', velocity: 55 },
  { sprint: 'S3', velocity: 50 },
  { sprint: 'S4', velocity: 68 },
  { sprint: 'S5', velocity: 74 },
];

const amData5 = [
  { region: 'AMER', active: 4200 },
  { region: 'EMEA', active: 3100 },
  { region: 'APAC', active: 2800 },
  { region: 'LATAM', active: 1500 },
];

// ─── Views ────────────────────────────────────────────────────────────────────

function AllMapsViews(): JSX.Element {
  return (
    <>
      <View id="am-v1" w={0.38} h={0.48}>
        <BarChart id="is-am-chart-1" data={amData1} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="product" />
          <ChartAxis axis="x" field="product" label="Product" />
          <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
          <ChartSeries field="revenue" label="Revenue" />
        </BarChart>
      </View>

      <View id="am-v2" w={0.38} h={0.48}>
        <LineChart id="is-am-chart-2" data={amData2} x={0} y={0} w={1} h={1}
          lineShape="circle" lineSmoothness={0.5} showPoints depth={0.3}>
          <ChartData keyField="month" />
          <ChartAxis axis="x" field="month" label="Quarter" />
          <ChartAxis axis="y" field="retention" label="Retention %" />
          <ChartSeries field="retention" label="Retention" />
        </LineChart>
      </View>

      <View id="am-v3" w={0.38} h={0.48}>
        <BarChart id="is-am-chart-3" data={amData3} x={0} y={0} w={1} h={1}
          orientation="horizontal" depth={0.3}>
          <ChartData keyField="layer" />
          <ChartAxis axis="x" field="layer" label="Layer" />
          <ChartAxis axis="y" field="errors" label="Errors / day" />
          <ChartSeries field="errors" label="Errors" />
        </BarChart>
      </View>

      <View id="am-v4" w={0.38} h={0.48}>
        <LineChart id="is-am-chart-4" data={amData4} x={0} y={0} w={1} h={1}
          lineShape="hexagon" lineSmoothness={0.3} showPoints depth={0.3}>
          <ChartData keyField="sprint" />
          <ChartAxis axis="x" field="sprint" label="Sprint" />
          <ChartAxis axis="y" field="velocity" label="Velocity" />
          <ChartSeries field="velocity" label="Velocity" />
        </LineChart>
      </View>

      <View id="am-v5" w={0.38} h={0.48}>
        <BarChart id="is-am-chart-5" data={amData5} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="region" />
          <ChartAxis axis="x" field="region" label="Region" />
          <ChartAxis axis="y" field="active" label="Active Users" />
          <ChartSeries field="active" label="Active" />
        </BarChart>
      </View>
    </>
  );
}

// ─── Kbd helper ───────────────────────────────────────────────────────────────

interface KbdCellProps {
  children: string;
  color: string;
}
function KbdCell({ children, color }: KbdCellProps): JSX.Element {
  return (
    <kbd
      style={{
        background: color + '22',
        border: `1px solid ${color}55`,
        borderRadius: 4,
        padding: '2px 8px',
        fontFamily: 'monospace',
        fontSize: 13,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </kbd>
  );
}

const C_CAM = '#5090e0';
const C_CAR = '#50c080';
const C_SCENE = '#c06040';
const C_MOD = '#c050e0';

// ─── Scene component ──────────────────────────────────────────────────────────

export const AllMapsScene = (): JSX.Element => {
  return (
    <Scene id="input-all-maps">
      <ProgressManager scrollUnits={1000} />
      <Camera mode="world" position={CAM_POS} target={CAM_TGT} fov={45} />
      <Lighting intensityScale={1}>
        <Ambient intensity={0.5} color="#d7e8ff" />
        <Directional intensity={1.0} color="#7af0ff" position={[-5, 10, 8]} />
        <Directional intensity={0.8} color="#ff70c0" position={[6, 8, 5]} />
      </Lighting>
      <Floor variant="grid" negativeZExtent={22} />
      <SpotlightRig center={[0, 0, 4]} target={[0, 0, -5]} height={1} showBeam={false} distance={0} decay={1} penumbra={0.5}>
        {spotlights.map((s, i) => <Spotlight key={i} {...s} />)}
      </SpotlightRig>

      {/* scope="window" — fires even outside canvas */}
      <InputController scope="window">
        {/* Camera orbit — three variants */}
        <Action id="orbit" type="camera.orbit">
          <PointerMap event="drag" button="left" axis="xy" />
        </Action>
        <Action id="orbit-right" type="camera.orbit" speed={0.7}>
          <PointerMap event="drag" button="right" axis="xy" />
        </Action>
        <Action id="orbit-mod" type="camera.orbit" speed={0.6}>
          <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
        </Action>
        {/* Camera dolly — wheel + pinch */}
        <Action id="dolly" type="camera.dolly">
          <WheelMap axis="y" />
          <PinchMap direction="both" threshold={1} />
        </Action>
        <Action id="dolly-precision" type="camera.dolly" speed={0.2}>
          <WheelMap axis="y" modifiers={['ctrl']} />
        </Action>
        <Action id="dolly-pinch-in" type="camera.dolly" speed={1.5}>
          <PinchMap direction="in" threshold={2} />
        </Action>
        <Action id="dolly-pinch-out" type="camera.dolly" speed={1.5}>
          <PinchMap direction="out" threshold={2} />
        </Action>
        {/* Camera reset */}
        <Action id="reset" type="camera.reset">
          <KeyMap keyName="r" />
          <PointerMap event="click" button="middle" />
        </Action>
        {/* Carousel nav */}
        <Action id="carousel-next" type="carousel.next" layoutId={LAYOUT_ID} stepSlides={1}>
          <KeyMap keyName="ArrowRight" />
          <PointerMap event="click" />
        </Action>
        <Action id="carousel-next-skip" type="carousel.next" layoutId={LAYOUT_ID} stepSlides={3}>
          <KeyMap keyName="ArrowRight" modifiers={['shift']} />
        </Action>
        <Action id="carousel-prev" type="carousel.prev" layoutId={LAYOUT_ID} stepSlides={1}>
          <KeyMap keyName="ArrowLeft" />
        </Action>
        <Action id="carousel-prev-skip" type="carousel.prev" layoutId={LAYOUT_ID} stepSlides={3}>
          <KeyMap keyName="ArrowLeft" modifiers={['shift']} />
        </Action>
        {/* Scene nav */}
        <Action id="scene-next" type="scene.next">
          <KeyMap keyName="ArrowDown" />
        </Action>
        <Action id="scene-prev" type="scene.prev">
          <KeyMap keyName="ArrowUp" />
        </Action>
      </InputController>

      <ViewLayout id={LAYOUT_ID} kind="carousel" loop activeIndex={0} zStep={12} fadeMin={0.2} spread={0.65}>
        <AllMapsViews />
      </ViewLayout>

      {/* Title panel */}
      <TextBox id="am-title" x={0.01} y={0.04} w={0.38} h={0.14} layer={5}>
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 14px',
            background: 'rgba(4, 12, 28, 0.88)',
            backdropFilter: 'blur(14px)',
            borderRadius: 8,
            border: '1px solid rgba(70, 130, 220, 0.3)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: '#c8deff' }}>All Input Maps</div>
          <div style={{ fontSize: 10, color: '#50c080', marginTop: 2, fontFamily: 'monospace' }}>scope="window"</div>
          <div style={{ fontSize: 10, color: 'rgba(140,180,240,0.6)', marginTop: 2 }}>
            Every map type, modifier combo, and multi-step action
          </div>
        </div>
      </TextBox>

      {/* Scope explanation */}
      <TextBox id="am-scope" x={0.01} y={0.2} w={0.38} h={0.4} layer={5}>
        <div
          style={{
            height: '100%',
            overflowY: 'auto',
            padding: '12px 14px',
            background: 'rgba(4, 12, 28, 0.85)',
            backdropFilter: 'blur(14px)',
            borderRadius: 8,
            border: '1px solid rgba(70, 130, 220, 0.25)',
            boxSizing: 'border-box',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: '#c8deff', marginBottom: 8 }}>
            scope="window" explained
          </div>
          <p style={{ fontSize: 11, color: 'rgba(170, 200, 255, 0.75)', lineHeight: 1.6, margin: '0 0 10px' }}>
            Input fires even when the cursor is <em>outside</em> the canvas. Try moving your cursor outside the scene
            boundary and dragging — the camera still orbits.
          </p>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#a0c8ff', marginBottom: 6 }}>Modifier combos:</div>
          {[
            { combo: 'No modifier', desc: 'Left Drag = Orbit · Scroll = Dolly · Click = Carousel Next' },
            { combo: pk('Mod'), desc: `${pk('Mod')}+Drag = Slow Orbit (×0.6)` },
            { combo: pk('Ctrl'), desc: `${pk('Ctrl')}+Scroll = Precision Dolly (×0.2)` },
            { combo: 'Right button', desc: 'Right Drag = Orbit (×0.7)' },
            { combo: 'Middle click', desc: 'Reset camera position' },
            { combo: pk('Shift'), desc: `${pk('Shift')}+→ = Jump 3 slides · ${pk('Shift')}+← = Back 3` },
          ].map(({ combo, desc }) => (
            <div key={combo} style={{ marginBottom: 7 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#7ab4ff', marginBottom: 2 }}>{combo}</div>
              <div style={{ fontSize: 10, color: 'rgba(140, 180, 240, 0.6)', lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>
      </TextBox>

      {/* Full cheatsheet */}
      <TextBox id="am-cheatsheet" x={0.01} y={0.62} w={0.38} h={0.35} layer={5}>
        <div
          style={{
            height: '100%',
            overflowY: 'auto',
            padding: '10px 14px',
            background: 'rgba(4, 12, 28, 0.88)',
            backdropFilter: 'blur(14px)',
            borderRadius: 8,
            border: '1px solid rgba(70, 130, 220, 0.25)',
            boxSizing: 'border-box',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: '#c8deff', marginBottom: 8 }}>Cheatsheet</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {[
              { kbd: 'Left Drag', desc: 'Orbit camera', color: C_CAM },
              { kbd: 'Right Drag', desc: 'Orbit ×0.7', color: C_CAM },
              { kbd: pk('Mod+Left Drag'), desc: 'Orbit ×0.6', color: C_MOD },
              { kbd: 'Scroll', desc: 'Dolly camera', color: C_CAM },
              { kbd: pk('Ctrl+Scroll'), desc: 'Dolly ×0.2', color: C_MOD },
              { kbd: 'Pinch', desc: 'Dolly (in/out)', color: C_CAM },
              { kbd: 'R', desc: 'Reset camera', color: '#e07050' },
              { kbd: 'Middle Click', desc: 'Reset camera', color: '#e07050' },
              { kbd: '→ / Click', desc: 'Carousel +1', color: C_CAR },
              { kbd: pk('Shift+→'), desc: 'Carousel +3', color: C_MOD },
              { kbd: '←', desc: 'Carousel −1', color: C_CAR },
              { kbd: pk('Shift+←'), desc: 'Carousel −3', color: C_MOD },
              { kbd: '↓', desc: 'Next scene', color: C_SCENE },
              { kbd: '↑', desc: 'Prev scene', color: C_SCENE },
            ].map(({ kbd, desc, color }) => (
              <div key={kbd} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <KbdCell color={color}>{kbd}</KbdCell>
                <span style={{ fontSize: 10, color: 'rgba(140, 180, 240, 0.65)' }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </TextBox>
    </Scene>
  );
};
