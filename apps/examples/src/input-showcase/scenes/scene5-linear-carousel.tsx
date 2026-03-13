// Scene 5: Linear Carousel — non-looping carousel with stepSlides=2 (default) and
// stepSlides=1 Shift+Arrow variant. Demonstrates inactiveScale and zStep.
import type { JSX } from 'react';
import {
  Action,
  Ambient,
  Camera,
  Directional,
  InputController,
  KeyMap,
  Lighting,
  PinchMap,
  ProgressManager,
  Scene,
  TextBox,
  View,
  ViewLayout,
} from '@brewsite/core';
import {
  BarChart,
  ChartAxis,
  ChartData,
  ChartSeries,
  useChartTheme,
  type ChartTheme,
} from '@brewsite/charts';
import { pk } from '../platformKeys';

const CAM_POS: [number, number, number] = [0, 1, 6.6];
const CAM_TGT: [number, number, number] = [0, 0, 0];
const LAYOUT_ID = 'linear-carousel-layout';

// ─── Chart data (5 products × 4 quarters) ────────────────────────────────────

const productAlphaData = [
  { quarter: 'Q1', sales: 65 },
  { quarter: 'Q2', sales: 82 },
  { quarter: 'Q3', sales: 74 },
  { quarter: 'Q4', sales: 95 },
];

const productBetaData = [
  { quarter: 'Q1', sales: 40 },
  { quarter: 'Q2', sales: 58 },
  { quarter: 'Q3', sales: 72 },
  { quarter: 'Q4', sales: 68 },
];

const productGammaData = [
  { quarter: 'Q1', sales: 90 },
  { quarter: 'Q2', sales: 75 },
  { quarter: 'Q3', sales: 88 },
  { quarter: 'Q4', sales: 100 },
];

const productDeltaData = [
  { quarter: 'Q1', sales: 30 },
  { quarter: 'Q2', sales: 45 },
  { quarter: 'Q3', sales: 55 },
  { quarter: 'Q4', sales: 70 },
];

const productEpsilonData = [
  { quarter: 'Q1', sales: 50 },
  { quarter: 'Q2', sales: 62 },
  { quarter: 'Q3', sales: 48 },
  { quarter: 'Q4', sales: 80 },
];

// ─── Shared views ─────────────────────────────────────────────────────────────

function LinearCarouselViews({ chartTheme }: { chartTheme: ChartTheme | undefined }): JSX.Element {
  return (
    <>
      <View id="lc-is-1" w={0.4} h={0.5}>
        <BarChart id="is-lin-chart-1" data={productAlphaData} theme={chartTheme} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="quarter" />
          <ChartAxis axis="x" field="quarter" label="Quarter" />
          <ChartAxis axis="y" field="sales" label="Alpha Sales" />
          <ChartSeries field="sales" label="Alpha" />
        </BarChart>
      </View>

      <View id="lc-is-2" w={0.4} h={0.5}>
        <BarChart id="is-lin-chart-2" data={productBetaData} theme={chartTheme} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="quarter" />
          <ChartAxis axis="x" field="quarter" label="Quarter" />
          <ChartAxis axis="y" field="sales" label="Beta Sales" />
          <ChartSeries field="sales" label="Beta" />
        </BarChart>
      </View>

      <View id="lc-is-3" w={0.4} h={0.5}>
        <BarChart id="is-lin-chart-3" data={productGammaData} theme={chartTheme} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="quarter" />
          <ChartAxis axis="x" field="quarter" label="Quarter" />
          <ChartAxis axis="y" field="sales" label="Gamma Sales" />
          <ChartSeries field="sales" label="Gamma" />
        </BarChart>
      </View>

      <View id="lc-is-4" w={0.4} h={0.5}>
        <BarChart id="is-lin-chart-4" data={productDeltaData} theme={chartTheme} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="quarter" />
          <ChartAxis axis="x" field="quarter" label="Quarter" />
          <ChartAxis axis="y" field="sales" label="Delta Sales" />
          <ChartSeries field="sales" label="Delta" />
        </BarChart>
      </View>

      <View id="lc-is-5" w={0.4} h={0.5}>
        <BarChart id="is-lin-chart-5" data={productEpsilonData} theme={chartTheme} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="quarter" />
          <ChartAxis axis="x" field="quarter" label="Quarter" />
          <ChartAxis axis="y" field="sales" label="Epsilon Sales" />
          <ChartSeries field="sales" label="Epsilon" />
        </BarChart>
      </View>
    </>
  );
}

// ─── Scene component ──────────────────────────────────────────────────────────

export const LinearCarouselScene = (): JSX.Element => {
  const chartTheme = useChartTheme();
  return (
    <Scene id="input-linear-carousel">
      <ProgressManager scrollUnits={800} />
      <Camera mode="world" position={CAM_POS} target={CAM_TGT} fov={42} />
      <Lighting intensityScale={1.2}>
        <Ambient intensity={0.9} color="#d7e5ff" />
        <Directional intensity={1.0} color="#edf4ff" position={[0, 2, 10]} />
      </Lighting>

      <InputController scope="canvas">
        {/* Default: jump 2 positions at a time */}
        <Action id="carousel-next" type="carousel.next" layoutId={LAYOUT_ID} stepSlides={2}>
          <KeyMap keyName="ArrowRight" />
          <KeyMap keyName=" " />
        </Action>
        <Action id="carousel-prev" type="carousel.prev" layoutId={LAYOUT_ID} stepSlides={2}>
          <KeyMap keyName="ArrowLeft" />
        </Action>
        {/* Shift variant: single position */}
        <Action id="carousel-next-single" type="carousel.next" layoutId={LAYOUT_ID} stepSlides={1}>
          <KeyMap keyName="ArrowRight" modifiers={['shift']} />
        </Action>
        <Action id="carousel-prev-single" type="carousel.prev" layoutId={LAYOUT_ID} stepSlides={1}>
          <KeyMap keyName="ArrowLeft" modifiers={['shift']} />
        </Action>
        <Action id="scene-next" type="scene.next">
          <KeyMap keyName="ArrowDown" />
        </Action>
        <Action id="scene-prev" type="scene.prev">
          <KeyMap keyName="ArrowUp" />
        </Action>
        <Action id="dolly" type="camera.dolly">
          <PinchMap direction="both" threshold={1} />
        </Action>
      </InputController>

      <ViewLayout id={LAYOUT_ID} kind="carousel" activeIndex={0} inactiveScale={0.75} zStep={8}>
        <LinearCarouselViews chartTheme={chartTheme} />
      </ViewLayout>

      {/* Info banner */}
      <TextBox id="lin-info" x={0.3} y={0.04} w={0.4} h={0.14} layer={3}>
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '0 16px',
            background: 'rgba(4, 12, 28, 0.85)',
            backdropFilter: 'blur(14px)',
            borderRadius: 10,
            border: '1px solid rgba(70, 130, 220, 0.3)',
            boxSizing: 'border-box',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: '#c8deff', marginBottom: 4 }}>
            Linear Carousel
          </div>
          <div style={{ fontSize: 11, color: 'rgba(160, 200, 255, 0.7)', lineHeight: 1.5 }}>
            <kbd style={{ background: '#50c08022', border: '1px solid #50c08055', borderRadius: 4, padding: '2px 8px', fontFamily: 'monospace', fontSize: 13, color: '#50c080' }}>→</kbd>{' / '}
            <kbd style={{ background: '#50c08022', border: '1px solid #50c08055', borderRadius: 4, padding: '2px 8px', fontFamily: 'monospace', fontSize: 13, color: '#50c080' }}>Space</kbd>{' '}
            jump 2 positions{' · '}
            <kbd style={{ background: '#c050e022', border: '1px solid #c050e055', borderRadius: 4, padding: '2px 8px', fontFamily: 'monospace', fontSize: 13, color: '#c050e0' }}>{pk('Shift+→')}</kbd>{' '}
            move 1{' · '}
            <kbd style={{ background: '#50c08022', border: '1px solid #50c08055', borderRadius: 4, padding: '2px 8px', fontFamily: 'monospace', fontSize: 13, color: '#50c080' }}>←</kbd>{' '}
            go back
          </div>
          <div style={{ fontSize: 10, color: 'rgba(120,160,220,0.5)', marginTop: 3 }}>
            loop=false · inactiveScale=0.75 · zStep=8
          </div>
        </div>
      </TextBox>
    </Scene>
  );
};
