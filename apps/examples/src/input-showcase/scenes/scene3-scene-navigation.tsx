// Scene 3 (two scenes): Scene Navigation — scene.next / scene.prev with stepScenes.
// SceneNavAScene and SceneNavBScene exported separately; both registered in page.
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
  TextBox,
  View,
  ViewLayout,
  WheelMap,
} from '@brewsite/core';
import {
  BarChart,
  ChartAxis,
  ChartData,
  ChartSeries,
} from '@brewsite/charts';
import { pk } from '../platformKeys';

const CAM_POS_A: [number, number, number] = [-2, 2, 8];
const CAM_POS_B: [number, number, number] = [2, 2, 8];
const CAM_TGT: [number, number, number] = [0, 0, 0];

// ─── Chart data ────────────────────────────────────────────────────────────────

const teamAData = [
  { quarter: 'Q1', revenue: 72 },
  { quarter: 'Q2', revenue: 88 },
  { quarter: 'Q3', revenue: 65 },
  { quarter: 'Q4', revenue: 94 },
];

const teamBData = [
  { quarter: 'Q1', revenue: 45 },
  { quarter: 'Q2', revenue: 62 },
  { quarter: 'Q3', revenue: 80 },
  { quarter: 'Q4', revenue: 74 },
];

const teamCData = [
  { quarter: 'Q1', revenue: 90 },
  { quarter: 'Q2', revenue: 78 },
  { quarter: 'Q3', revenue: 85 },
  { quarter: 'Q4', revenue: 99 },
];

const teamDData = [
  { quarter: 'Q1', revenue: 55 },
  { quarter: 'Q2', revenue: 70 },
  { quarter: 'Q3', revenue: 60 },
  { quarter: 'Q4', revenue: 82 },
];

const teamEData = [
  { quarter: 'Q1', revenue: 38 },
  { quarter: 'Q2', revenue: 50 },
  { quarter: 'Q3', revenue: 44 },
  { quarter: 'Q4', revenue: 68 },
];

const teamFData = [
  { quarter: 'Q1', revenue: 64 },
  { quarter: 'Q2', revenue: 75 },
  { quarter: 'Q3', revenue: 91 },
  { quarter: 'Q4', revenue: 87 },
];

// ─── Shared InputController spec ──────────────────────────────────────────────

function SceneNavInput(): JSX.Element {
  return (
    <InputController scope="canvas">
      <Action id="scene-next" type="scene.next">
        <KeyMap keyName="ArrowRight" />
        <PointerMap event="click" />
        <WheelMap axis="y" />
      </Action>
      <Action id="scene-prev" type="scene.prev">
        <KeyMap keyName="ArrowLeft" />
      </Action>
      <Action id="skip-next" type="scene.next" stepScenes={2}>
        <KeyMap keyName="ArrowRight" modifiers={['shift']} />
      </Action>
      <Action id="skip-prev" type="scene.prev" stepScenes={2}>
        <KeyMap keyName="ArrowLeft" modifiers={['shift']} />
      </Action>
      <Action id="dolly" type="camera.dolly">
        <PinchMap direction="both" threshold={1} />
      </Action>
    </InputController>
  );
}

// ─── Shared chart stack ────────────────────────────────────────────────────────

interface StackChartsProps {
  variant: 'a' | 'b';
}

function StackCharts({ variant }: StackChartsProps): JSX.Element {
  const dataSet = variant === 'a'
    ? [teamAData, teamBData, teamCData]
    : [teamDData, teamEData, teamFData];
  const labels = variant === 'a'
    ? ['Team A', 'Team B', 'Team C']
    : ['Team D', 'Team E', 'Team F'];
  const ids = variant === 'a'
    ? ['is-sn-chart-a1', 'is-sn-chart-a2', 'is-sn-chart-a3']
    : ['is-sn-chart-b1', 'is-sn-chart-b2', 'is-sn-chart-b3'];

  return (
    <ViewLayout kind="stack" direction="horizontal" x={0.05} y={0.12} w={0.9} h={0.72} gap={0.04}>
      {dataSet.map((data, i) => (
        <View id={`sn-v${variant}${i}`} key={ids[i]}>
          <BarChart
            id={ids[i]}
            data={data}
            x={0} y={0} w={1} h={1}
            depth={0.3}
          >
            <ChartData keyField="quarter" />
            <ChartAxis axis="x" field="quarter" label="Quarter" />
            <ChartAxis axis="y" field="revenue" label={labels[i]} />
            <ChartSeries field="revenue" label={labels[i]} />
          </BarChart>
        </View>
      ))}
    </ViewLayout>
  );
}

// ─── Shared info bar ──────────────────────────────────────────────────────────

interface InfoBarProps {
  text: string;
}

function InfoBar({ text }: InfoBarProps): JSX.Element {
  return (
    <TextBox id="sn-info" x={0.05} y={0.04} w={0.9} h={0.07} layer={2}>
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          background: 'rgba(4, 12, 28, 0.85)',
          backdropFilter: 'blur(14px)',
          borderRadius: 8,
          border: '1px solid rgba(70, 130, 220, 0.3)',
          boxSizing: 'border-box',
          fontSize: 12,
          color: 'rgba(180, 210, 255, 0.9)',
          gap: 8,
        }}
      >
        <span>{text}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
          <kbd style={{ background: '#c0604022', border: '1px solid #c0604055', borderRadius: 5, padding: '2px 8px', fontFamily: 'monospace', fontSize: 13, color: '#c06040' }}>→</kbd>
          <kbd style={{ background: '#c0604022', border: '1px solid #c0604055', borderRadius: 5, padding: '2px 8px', fontFamily: 'monospace', fontSize: 13, color: '#c06040' }}>←</kbd>
          <span style={{ color: 'rgba(140,170,220,0.5)', fontSize: 10 }}>next/prev</span>
          <kbd style={{ background: '#c050e022', border: '1px solid #c050e055', borderRadius: 5, padding: '2px 8px', fontFamily: 'monospace', fontSize: 13, color: '#c050e0' }}>{pk('Shift+→')}</kbd>
          <span style={{ color: 'rgba(140,170,220,0.5)', fontSize: 10 }}>skip 2</span>
        </span>
      </div>
    </TextBox>
  );
}

// ─── Exported scene components ────────────────────────────────────────────────

export const SceneNavAScene = (): JSX.Element => {
  return (
    <Scene id="input-scene-nav-a">
      <ProgressManager scrollUnits={800} />
      <Camera mode="world" position={CAM_POS_A} target={CAM_TGT} fov={50} />
      <Lighting intensityScale={1}>
        <Ambient intensity={0.55} color="#d7e8ff" />
        <Directional intensity={1.2} color="#b0ccff" position={[-5, 10, 8]} />
        <Directional intensity={0.7} color="#ffd8b0" position={[8, 4, 6]} />
      </Lighting>
      <Floor variant="grid" negativeZExtent={18} />
      <SceneNavInput />
      <InfoBar text={`Scene Nav (Part 1 of 2) — Arrow keys, Click, or Scroll to move scenes. ${pk('Shift')}+Arrow skips 2.`} />
      <StackCharts variant="a" />
    </Scene>
  );
};

export const SceneNavBScene = (): JSX.Element => {
  return (
    <Scene id="input-scene-nav-b">
      <ProgressManager scrollUnits={800} />
      <Camera mode="world" position={CAM_POS_B} target={CAM_TGT} fov={50} />
      <Lighting intensityScale={1}>
        <Ambient intensity={0.55} color="#d7e8ff" />
        <Directional intensity={1.2} color="#b0ccff" position={[5, 10, 8]} />
        <Directional intensity={0.7} color="#ffd8b0" position={[-8, 4, 6]} />
      </Lighting>
      <Floor variant="grid" negativeZExtent={18} />
      <SceneNavInput />
      <InfoBar text="Scene Nav (Part 2 of 2) — You arrived here by navigating from Scene Nav A." />
      <StackCharts variant="b" />
    </Scene>
  );
};
