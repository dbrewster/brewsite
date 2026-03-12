// Scene 4: Nested <View> demonstrating composition chaining.
// An outer view with padding contains an inner view at full local viewport.
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
  useChartTheme,
} from '@brewsite/charts';

const CAM_POS: [number, number, number] = [0, 1.5, 6.6];
const CAM_TGT: [number, number, number] = [0, 0.08, 0];

const nestedData = [
  { region: 'EMEA', growth: 14 },
  { region: 'APAC', growth: 22 },
  { region: 'AMER', growth: 18 },
  { region: 'LATAM', growth: 9 },
];

export const NestedViewsScene = (): JSX.Element => {
  const chartTheme = useChartTheme();
  return (
  <Scene id="nested-views">
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={CAM_POS} target={CAM_TGT} fov={42} />
    <Lighting intensityScale={1.2}>
      <Ambient intensity={0.9} color="#d7e5ff" />
      <Directional intensity={1.0} color="#edf4ff" position={[0, 2, 10]} />
    </Lighting>

    {/* Outer view: 90% of viewport with 2% padding on all sides */}
    <View id="outer" x={0.05} y={0.05} w={0.9} h={0.9} padding={0.02}>
      {/* Inner view: fills the outer view's content bounds (after padding) */}
      <View id="inner" x={0} y={0} w={1} h={1}>
        <BarChart
          id="nested-chart"
          data={nestedData}
          theme={chartTheme}
          x={0}
          y={0}
          w={1}
          h={1}
          depth={0.35}
        >
          <ChartData keyField="region" />
          <ChartAxis axis="x" field="region" label="Region" />
          <ChartAxis axis="y" field="growth" label="Growth %" />
          <ChartSeries field="growth" label="Growth" />
        </BarChart>
      </View>
    </View>
  </Scene>
  );
};
