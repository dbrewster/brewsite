// Scene 2: <ViewLayout kind="stack"> with three child <View> elements.
// Horizontal stack distributes space equally with a 2% NVS gap.
import type { JSX } from 'react';
import {
  Camera,
  Lighting,
  Ambient,
  Directional,
  ProgressManager,
  Scene,
  View,
  ViewLayout,
} from '@brewsite/core';
import {
  BarChart,
  ChartData,
  ChartAxis,
  ChartSeries,
} from '@brewsite/charts';

const CAM_POS: [number, number, number] = [0, 1.5, 6.6];
const CAM_TGT: [number, number, number] = [0, 0.08, 0];

const dataA = [
  { month: 'Jan', value: 40 },
  { month: 'Feb', value: 55 },
  { month: 'Mar', value: 70 },
];

const dataB = [
  { month: 'Jan', value: 90 },
  { month: 'Feb', value: 65 },
  { month: 'Mar', value: 80 },
];

const dataC = [
  { month: 'Jan', value: 20 },
  { month: 'Feb', value: 35 },
  { month: 'Mar', value: 50 },
];

export const StackLayoutScene = (): JSX.Element => {
  return (
  <Scene id="stack-layout">
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={CAM_POS} target={CAM_TGT} fov={42} />
    <Lighting intensityScale={1.2}>
      <Ambient intensity={0.9} color="#d7e5ff" />
      <Directional intensity={1.0} color="#edf4ff" position={[0, 2, 10]} />
    </Lighting>

    <ViewLayout kind="stack" direction="horizontal" gap={0.02} y={.2} h={.7}>
      <View id="v1">
        <BarChart id="stack-chart-1" data={dataA} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="month" />
          <ChartAxis axis="x" field="month" label="Month" />
          <ChartAxis axis="y" field="value" label="Sales" />
          <ChartSeries field="value" label="Sales" />
        </BarChart>
      </View>

      <View id="v2">
        <BarChart id="stack-chart-2" data={dataB} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="month" />
          <ChartAxis axis="x" field="month" label="Month" />
          <ChartAxis axis="y" field="value" label="Traffic" />
          <ChartSeries field="value" label="Traffic" />
        </BarChart>
      </View>

      <View id="v3">
        <BarChart id="stack-chart-3" data={dataC} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="month" />
          <ChartAxis axis="x" field="month" label="Month" />
          <ChartAxis axis="y" field="value" label="Signups" />
          <ChartSeries field="value" label="Signups" />
        </BarChart>
      </View>
    </ViewLayout>
  </Scene>
  );
};
