// Scene 1: Two standalone <View> elements positioned side-by-side.
// Each view contains a BarChart at local full-viewport (x=0 y=0 w=1 h=1),
// composed into the view's absolute NVS bounds.
import type { JSX } from 'react';
import {
  Camera,
  Lighting,
  Ambient,
  Directional,
  ProgressManager,
  Scene,
  View,
} from '@brewsite/core';
import {
  BarChart,
  ChartData,
  ChartAxis,
  ChartSeries,
} from '@brewsite/charts';

const dataLeft = [
  { quarter: 'Q1', revenue: 120, costs: 80 },
  { quarter: 'Q2', revenue: 150, costs: 90 },
  { quarter: 'Q3', revenue: 180, costs: 95 },
  { quarter: 'Q4', revenue: 210, costs: 100 },
];

const dataRight = [
  { quarter: 'Q1', users: 400, sessions: 1200 },
  { quarter: 'Q2', users: 520, sessions: 1800 },
  { quarter: 'Q3', users: 680, sessions: 2400 },
  { quarter: 'Q4', users: 810, sessions: 3100 },
];

const CAM_POS: [number, number, number] = [0, 0, 6.6];
const CAM_TGT: [number, number, number] = [0, 0, 0];

export const StandaloneViewsScene = (): JSX.Element => {
  return (
  <Scene id="standalone-views">
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={CAM_POS} target={CAM_TGT} fov={"42deg"} />
    <Lighting intensityScale={1.2}>
      <Ambient intensity={0.9} color="#d7e5ff" />
      <Directional intensity={1.0} color="#edf4ff" position={[0, 2, 10]} />
    </Lighting>

    {/* Left view — revenue chart */}
    <View id="left" x={"2%"} y={"25%"} w={"46%"} h={"50%"}>
      <BarChart
        id="chart-left"
        data={dataLeft}
        x={0}
        y={0}
        w={"100%"}
        h={"100%"}
        depth={0.35}
      >
        <ChartData keyField="quarter" />
        <ChartAxis axis="x" field="quarter" label="Quarter" />
        <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
        <ChartSeries field="revenue" label="Revenue" />
        <ChartSeries field="costs" label="Costs" />
      </BarChart>
    </View>

    {/* Right view — engagement chart */}
    <View id="right" x={"52%"} y={"25%"} w={"46%"} h={"50%"}>
      <BarChart
        id="chart-right"
        data={dataRight}
        x={0}
        y={0}
        w={"100%"}
        h={"100%"}
        depth={0.35}
      >
        <ChartData keyField="quarter" />
        <ChartAxis axis="x" field="quarter" label="Quarter" />
        <ChartAxis axis="y" field="users" label="Users" />
        <ChartSeries field="users" label="Users" />
        <ChartSeries field="sessions" label="Sessions" />
      </BarChart>
    </View>
  </Scene>
  );
};
