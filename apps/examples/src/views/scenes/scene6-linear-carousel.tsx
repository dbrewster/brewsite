// Scene 6: <ViewLayout kind="carousel" loop={false}> — linear fan-out carousel.
// The active view is centered; inactive views fan out horizontally with
// exponentially decreasing scale and increasing z-depth.
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
  LineChart,
} from '@brewsite/charts';

const CAM_POS: [number, number, number] = [0, 1, 6.6];
const CAM_TGT: [number, number, number] = [0, 0, 0];

const dataAlpha = [
  { quarter: 'Q1', value: 65 },
  { quarter: 'Q2', value: 82 },
  { quarter: 'Q3', value: 74 },
  { quarter: 'Q4', value: 95 },
];

const dataBeta = [
  { quarter: 'Q1', value: 40 },
  { quarter: 'Q2', value: 58 },
  { quarter: 'Q3', value: 72 },
  { quarter: 'Q4', value: 68 },
];

const dataGamma = [
  { quarter: 'Q1', value: 90 },
  { quarter: 'Q2', value: 75 },
  { quarter: 'Q3', value: 88 },
  { quarter: 'Q4', value: 100 },
];

const dataDelta = [
  { quarter: 'Q1', value: 30 },
  { quarter: 'Q2', value: 45 },
  { quarter: 'Q3', value: 55 },
  { quarter: 'Q4', value: 70 },
];

const dataEpsilon = [
  { quarter: 'Q1', value: 50 },
  { quarter: 'Q2', value: 62 },
  { quarter: 'Q3', value: 48 },
  { quarter: 'Q4', value: 80 },
];

/** Shared views for all linear carousel scenes — only activeIndex changes. */
function LinearCarouselViews(): JSX.Element {
  return (
    <>
      <View id="lc1" w={0.4} h={0.5}>
        <BarChart id="lin-chart-1" data={dataAlpha} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="quarter" />
          <ChartAxis axis="x" field="quarter" label="Quarter" />
          <ChartAxis axis="y" field="value" label="Alpha" />
          <ChartSeries field="value" label="Alpha" />
        </BarChart>
      </View>

      <View id="lc2" w={0.4} h={0.5}>
        <BarChart id="lin-chart-2" data={dataBeta} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="quarter" />
          <ChartAxis axis="x" field="quarter" label="Quarter" />
          <ChartAxis axis="y" field="value" label="Beta" />
          <ChartSeries field="value" label="Beta" />
        </BarChart>
      </View>

      <View id="lc3" w={0.4} h={0.5}>
        <LineChart id="lin-chart-3" data={dataGamma} x={0} y={0} w={1} h={1}
                   lineShape="circle" lineSmoothness={0.5} showPoints={true} depth={0.3}>
          <ChartData keyField="quarter" />
          <ChartAxis axis="x" field="quarter" label="Quarter" />
          <ChartAxis axis="y" field="value" label="Gamma" />
          <ChartSeries field="value" label="Gamma" />
        </LineChart>
      </View>

      <View id="lc4" w={0.4} h={0.5}>
        <BarChart id="lin-chart-4" data={dataDelta} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="quarter" />
          <ChartAxis axis="x" field="quarter" label="Quarter" />
          <ChartAxis axis="y" field="value" label="Delta" />
          <ChartSeries field="value" label="Delta" />
        </BarChart>
      </View>

      <View id="lc5" w={0.4} h={0.5}>
        <BarChart id="lin-chart-5" data={dataEpsilon} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="quarter" />
          <ChartAxis axis="x" field="quarter" label="Quarter" />
          <ChartAxis axis="y" field="value" label="Epsilon" />
          <ChartSeries field="value" label="Epsilon" />
        </BarChart>
      </View>
    </>
  );
}

/** Linear carousel — activeIndex 0 (first view centered, rest fan right). */
export const LinearCarouselScene1 = (): JSX.Element => {
  return (
    <Scene id="linear-carousel-1" primaryCarouselId="lin-carousel-1-layout">
      <ProgressManager scrollUnits={800} />
      <Camera mode="world" position={CAM_POS} target={CAM_TGT} fov={42} />
      <Lighting intensityScale={1.2}>
        <Ambient intensity={0.9} color="#d7e5ff" />
        <Directional intensity={1.0} color="#edf4ff" position={[0, 2, 10]} />
      </Lighting>
      <ViewLayout id="lin-carousel-1-layout" kind="carousel" activeIndex={0} inactiveScale={0.75} zStep={8}>
        <LinearCarouselViews />
      </ViewLayout>
    </Scene>
  );
};

/** Linear carousel — activeIndex 1 (second view centered). */
export const LinearCarouselScene2 = (): JSX.Element => {
  return (
    <Scene id="linear-carousel-2" primaryCarouselId="lin-carousel-2-layout">
      <ProgressManager scrollUnits={800} />
      <Camera mode="world" position={CAM_POS} target={CAM_TGT} fov={42} />
      <Lighting intensityScale={1.2}>
        <Ambient intensity={0.9} color="#d7e5ff" />
        <Directional intensity={1.0} color="#edf4ff" position={[0, 2, 10]} />
      </Lighting>
      <ViewLayout id="lin-carousel-2-layout" kind="carousel" activeIndex={1} inactiveScale={0.75} zStep={8}>
        <LinearCarouselViews />
      </ViewLayout>
    </Scene>
  );
};

/** Linear carousel — activeIndex 2 (middle view centered). */
export const LinearCarouselScene3 = (): JSX.Element => {
  return (
    <Scene id="linear-carousel-3" primaryCarouselId="lin-carousel-3-layout">
      <ProgressManager scrollUnits={800} />
      <Camera mode="world" position={CAM_POS} target={CAM_TGT} fov={42} />
      <Lighting intensityScale={1.2}>
        <Ambient intensity={0.9} color="#d7e5ff" />
        <Directional intensity={1.0} color="#edf4ff" position={[0, 2, 10]} />
      </Lighting>
      <ViewLayout id="lin-carousel-3-layout" kind="carousel" activeIndex={2} inactiveScale={0.75} zStep={8}>
        <LinearCarouselViews />
      </ViewLayout>
    </Scene>
  );
};
