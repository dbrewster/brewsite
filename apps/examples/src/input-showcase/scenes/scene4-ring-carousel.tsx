// Scene 4: Ring Carousel — looping 3D ring driven by carousel.next / carousel.prev.
// Demonstrates: stepSlides=1 and stepSlides=2, SpotlightRig, loop=true ViewLayout.
import type {JSX} from 'react';
import {
  Action,
  Ambient,
  Camera,
  CarouselTray,
  Floor,
  formatModifier,
  InputController,
  KeyMap,
  Lighting,
  Directional,
  type OrbitFn,
  PointerMap,
  ProgressManager,
  Scene,
  Spotlight,
  SpotlightRig,
  TextBox,
  useCarouselState,
  View,
  ViewLayout,
} from '@brewsite/core';
import {BarChart, ChartAxis, ChartData, ChartSeries, LineChart,} from '@brewsite/charts';

const CAM_POS: [number, number, number] = [0, 1, 6.6];
const CAM_TGT: [number, number, number] = [0, 0, 0];
const LAYOUT_ID = 'ring-carousel-layout';

// ─── Seeded spotlight rig ─────────────────────────────────────────────────────

const seeded = (seed: number) => {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
};
const rng = seeded(17);

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

const spotlights: SpotlightDef[] = Array.from({ length: 5 }, () => {
  const fX = 0.2 + rng() * 0.6, fY = 0.25 + rng() * 0.5, fZ = 0.15 + rng() * 0.4;
  const aX = 3 + rng() * 5, aY = 2 + rng() * 3, aZ = 1 + rng() * 3;
  const oY = 1 + rng() * 3;
  const pX = rng() * Math.PI * 2, pY = rng() * Math.PI * 2, pZ = rng() * Math.PI * 2;
  return {
    color: randColor(),
    intensity: 20 + rng() * 30,
    angle: Math.PI / 20 + rng() * Math.PI / 8,
    orbit: ((t: number): [number, number, number] => [
      Math.sin(t * fX + pX) * aX,
      Math.sin(t * fY + pY) * aY + oY,
      Math.cos(t * fZ + pZ) * aZ,
    ]) as OrbitFn,
  };
});

// ─── Chart data (6 datasets) ──────────────────────────────────────────────────

const ringData1 = [
  { metric: 'API', interactions: 420 },
  { metric: 'UI', interactions: 680 },
  { metric: 'SDK', interactions: 310 },
  { metric: 'CLI', interactions: 195 },
];

const ringData2 = [
  { month: 'Jan', latency: 42 },
  { month: 'Feb', latency: 38 },
  { month: 'Mar', latency: 35 },
  { month: 'Apr', latency: 28 },
];

const ringData3 = [
  { region: 'US', throughput: 92 },
  { region: 'EU', throughput: 74 },
  { region: 'APAC', throughput: 61 },
  { region: 'LATAM', throughput: 45 },
];

const ringData4 = [
  { tier: 'Free', errors: 12 },
  { tier: 'Pro', errors: 5 },
  { tier: 'Team', errors: 3 },
  { tier: 'Ent', errors: 1 },
];

const ringData5 = [
  { week: 'W1', deploys: 8 },
  { week: 'W2', deploys: 14 },
  { week: 'W3', deploys: 11 },
  { week: 'W4', deploys: 19 },
];

const ringData6 = [
  { day: 'Mon', uptime: 99.8 },
  { day: 'Tue', uptime: 99.9 },
  { day: 'Wed', uptime: 99.5 },
  { day: 'Thu', uptime: 100 },
  { day: 'Fri', uptime: 99.7 },
];

// ─── Shared views ─────────────────────────────────────────────────────────────

function RingCarouselViews(): JSX.Element {
  return (
    <>
      <View id="rc1" w={0.42} h={0.52}>
        <BarChart id="is-ring-chart-1" data={ringData1} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="metric" />
          <ChartAxis axis="x" field="metric" label="Interface" />
          <ChartAxis axis="y" field="interactions" label="Interactions" />
          <ChartSeries field="interactions" label="Interactions" />
        </BarChart>
      </View>

      <View id="rc2" w={0.42} h={0.52}>
        <LineChart id="is-ring-chart-2" data={ringData2} x={0} y={0} w={1} h={1}
          lineShape="circle" lineSmoothness={0.5} showPoints depth={0.3}>
          <ChartData keyField="month" />
          <ChartAxis axis="x" field="month" label="Month" />
          <ChartAxis axis="y" field="latency" label="Latency (ms)" />
          <ChartSeries field="latency" label="Latency" />
        </LineChart>
      </View>

      <View id="rc3" w={0.42} h={0.52}>
        <BarChart id="is-ring-chart-3" data={ringData3} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="region" />
          <ChartAxis axis="x" field="region" label="Region" />
          <ChartAxis axis="y" field="throughput" label="Throughput %" />
          <ChartSeries field="throughput" label="Throughput" />
        </BarChart>
      </View>

      <View id="rc4" w={0.42} h={0.52}>
        <BarChart id="is-ring-chart-4" data={ringData4} x={0} y={0} w={1} h={1}
          orientation="horizontal" depth={0.3}>
          <ChartData keyField="tier" />
          <ChartAxis axis="x" field="tier" label="Tier" />
          <ChartAxis axis="y" field="errors" label="Errors / Day" />
          <ChartSeries field="errors" label="Errors" />
        </BarChart>
      </View>

      <View id="rc5" w={0.42} h={0.52}>
        <BarChart id="is-ring-chart-5" data={ringData5} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="week" />
          <ChartAxis axis="x" field="week" label="Week" />
          <ChartAxis axis="y" field="deploys" label="Deploys" />
          <ChartSeries field="deploys" label="Deploys" />
        </BarChart>
      </View>

      <View id="rc6" w={0.42} h={0.52}>
        <LineChart id="is-ring-chart-6" data={ringData6} x={0} y={0} w={1} h={1}
          lineShape="hexagon" lineSmoothness={0.3} showPoints depth={0.3}>
          <ChartData keyField="day" />
          <ChartAxis axis="x" field="day" label="Day" />
          <ChartAxis axis="y" field="uptime" label="Uptime %" />
          <ChartSeries field="uptime" label="Uptime" />
        </LineChart>
      </View>
    </>
  );
}

// ─── Scene component ──────────────────────────────────────────────────────────

export const RingCarouselScene = (): JSX.Element => {
  return (
    <Scene id="input-ring-carousel" primaryCarouselId={LAYOUT_ID}>
      <ProgressManager scrollUnits={800} />
      <Camera mode="world" position={CAM_POS} target={CAM_TGT} fov={42} />
      <Lighting intensityScale={1.2}>
        <Ambient intensity={2.8} color="#d7e5ff" />
        <Directional intensity={0} color='#ffffff' position={[0, 0, 0]}/>
      </Lighting>
      <Floor variant="grid" negativeZExtent={20} />
      <SpotlightRig center={[0, 0, 3]} target={[0, 0, -7]} height={3} showBeam={false} distance={0} decay={.5} penumbra={0.5}>
        {spotlights.map((s, i) => <Spotlight key={i} {...s} />)}
      </SpotlightRig>

      <InputController scope="canvas">
        <Action id="default-carousel-next" type="carousel.next" layoutId={LAYOUT_ID} stepSlides={1}>
          <KeyMap keyName="ArrowRight" />
          <PointerMap event="click" />
        </Action>
        <Action id="carousel-next-skip" type="carousel.next" layoutId={LAYOUT_ID} stepSlides={2}>
          <KeyMap keyName="ArrowRight" modifiers={['shift']} />
        </Action>
        <Action id="default-carousel-prev" type="carousel.prev" layoutId={LAYOUT_ID} stepSlides={1}>
          <KeyMap keyName="ArrowLeft" />
        </Action>
        <Action id="carousel-prev-skip" type="carousel.prev" layoutId={LAYOUT_ID} stepSlides={2}>
          <KeyMap keyName="ArrowLeft" modifiers={['shift']} />
        </Action>
      </InputController>

      <ViewLayout id={LAYOUT_ID} kind="carousel" loop activeIndex={0} zStep={15} fadeMin={0.15} spread={0.7}>
        <RingCarouselViews />
        <CarouselTray  metalness={.1}/>
      </ViewLayout>

      {/* Title */}
      <TextBox id="ring-title" x={0.02} y={0.06} w={0.38} h={0.12} layer={3}>
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 14px',
            background: 'rgba(4, 12, 28, 0.85)',
            backdropFilter: 'blur(14px)',
            borderRadius: 8,
            border: '1px solid rgba(70, 130, 220, 0.3)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: '#c8deff' }}>Ring Carousel</div>
          <div style={{ fontSize: 11, color: 'rgba(140,180,255,0.6)' }}>loop=true · 6 views · zStep=15</div>
        </div>
      </TextBox>

      {/* Controls reference */}
      <TextBox id="ring-controls" x={0.42} y={0.14} w={0.38} h={0.20} layer={3}>
        <div
          style={{
            height: '100%',
            padding: '10px 14px',
            background: 'rgba(4, 12, 28, 0.85)',
            backdropFilter: 'blur(14px)',
            borderRadius: 8,
            border: '1px solid rgba(70, 130, 220, 0.3)',
            boxSizing: 'border-box',
            fontSize: 11,
            color: 'rgba(160, 200, 255, 0.8)',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6, color: '#c8deff' }}>Controls</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              { keys: 'Scroll X', desc: 'Rotate carousel' },
              { keys: 'Scroll Y', desc: 'Change scene' },
              { keys: '→ / Click', desc: 'Rotate forward (×1)' },
              { keys: `${formatModifier('shift')}+→`, desc: 'Jump 2 positions' },
              { keys: '←', desc: 'Rotate back (×1)' },
              { keys: `${formatModifier('shift')}+←`, desc: 'Jump back 2' },
              { keys: '↑ / ↓', desc: 'Change scene' },
            ].map(({ keys, desc }) => (
              <div key={keys} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                <kbd style={{ background: '#50c08022', border: '1px solid #50c08055', borderRadius: 4, padding: '2px 8px', fontFamily: 'monospace', fontSize: 13, color: '#50c080' }}>
                  {keys}
                </kbd>
                <span style={{ color: 'rgba(140,180,230,0.65)' }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </TextBox>
    </Scene>
  );
};
