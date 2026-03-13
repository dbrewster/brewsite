// Scene 5: <ViewLayout kind="stack" direction="vertical"> with three child <View> elements.
// Vertical stack distributes space top-to-bottom with a 2% NVS gap.
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
  useChartTheme,
  LineChart,
} from '@brewsite/charts';

const CAM_POS: [number, number, number] = [0, 1.5, 6.6];
const CAM_TGT: [number, number, number] = [0, 0.08, 0];

const dataRevenue = [
  { month: 'Jan', revenue: 85 },
  { month: 'Feb', revenue: 92 },
  { month: 'Mar', revenue: 78 },
  { month: 'Apr', revenue: 110 },
];

const dataUsers = [
  { month: 'Jan', users: 320 },
  { month: 'Feb', users: 410 },
  { month: 'Mar', users: 380 },
  { month: 'Apr', users: 520 },
];

const dataConversion = [
  { month: 'Jan', rate: 3.2 },
  { month: 'Feb', rate: 4.1 },
  { month: 'Mar', rate: 3.8 },
  { month: 'Apr', rate: 5.0 },
];

export const StackVerticalScene = (): JSX.Element => {
  const chartTheme = useChartTheme();
  return (
    <Scene id="stack-vertical">
      <ProgressManager scrollUnits={1200} />
      <Camera mode="world" position={CAM_POS} target={CAM_TGT} fov={42} />
      <Lighting intensityScale={1.2}>
        <Ambient intensity={0.9} color="#d7e5ff" />
        <Directional intensity={1.0} color="#edf4ff" position={[0, 2, 10]} />
      </Lighting>

      <ViewLayout kind="stack" direction="vertical" gap={0.02} x={0.1} w={0.8} y={0.05} h={0.9}>
        <View id="sv1">
          <BarChart id="vstack-chart-1" data={dataRevenue} theme={chartTheme} x={0} y={0} w={1} h={1} depth={0.3}>
            <ChartData keyField="month" />
            <ChartAxis axis="x" field="month" label="Month" />
            <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
            <ChartSeries field="revenue" label="Revenue" />
          </BarChart>
        </View>

        <View id="sv2">
          <BarChart id="vstack-chart-2" data={dataUsers} theme={chartTheme} x={0} y={0} w={1} h={1} depth={0.3}>
            <ChartData keyField="month" />
            <ChartAxis axis="x" field="month" label="Month" />
            <ChartAxis axis="y" field="users" label="Active Users" />
            <ChartSeries field="users" label="Users" />
          </BarChart>
        </View>

        <View id="sv3">
          <LineChart id="vstack-chart-3" data={dataConversion} theme={chartTheme} x={0} y={0} w={1} h={1}
                     lineShape="circle" lineSmoothness={0.4} showPoints={true} depth={0.3}>
            <ChartData keyField="month" />
            <ChartAxis axis="x" field="month" label="Month" />
            <ChartAxis axis="y" field="rate" label="Conversion %" />
            <ChartSeries field="rate" label="Conversion" />
          </LineChart>
        </View>
      </ViewLayout>
    </Scene>
  );
};
