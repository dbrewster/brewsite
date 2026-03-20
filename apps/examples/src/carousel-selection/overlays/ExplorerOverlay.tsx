import type { JSX } from 'react';
import { useMemo } from 'react';
import {
  corePlugin, SceneEngine, SceneCanvas, ScrollStage, InputCoordinator,
  BackgroundLayer, EngineARContainer, EngineOverlayHost,
  Scene, Camera, Lighting, Ambient, Directional, Floor, ProgressManager,
  View, ViewLayout, CarouselTray, Action, InputController, KeyMap,
  type WidgetPlugin, type ActiveTheme,
} from '@brewsite/core';
import { chartPlugin, BarChart, ChartAxis, ChartData, ChartSeries, LineChart } from '@brewsite/charts';
import { themesPlugin } from '@brewsite/themes';
import { FullScreenCloseButton } from './FullScreenCloseButton';

const innerData1 = [
  { label: 'Mon', value: 42 }, { label: 'Tue', value: 58 },
  { label: 'Wed', value: 35 }, { label: 'Thu', value: 71 },
];
const innerData2 = [
  { label: 'Mon', value: 22 }, { label: 'Tue', value: 48 },
  { label: 'Wed', value: 65 }, { label: 'Thu', value: 31 },
];
const innerData3 = [
  { label: 'Mon', value: 55 }, { label: 'Tue', value: 33 },
  { label: 'Wed', value: 44 }, { label: 'Thu', value: 66 },
];

function createExplorerPlugins(): { plugins: WidgetPlugin[] } {
  return { plugins: [corePlugin(), chartPlugin(), themesPlugin()] };
}

const InnerPickerScene = (): JSX.Element => (
  <Scene id="inner-picker" primaryCarouselId="inner-carousel">
    <ProgressManager scrollUnits={600} />
    <Camera mode="world" position={[0, 1, 6]} target={[0, 0, 0]} fov={42} />
    <Lighting intensityScale={1.0}>
      <Ambient intensity={2.5} color="#ffe8d7" />
      <Directional intensity={1.0} color="#ffffff" position={[2, 4, 3]} />
    </Lighting>
    <Floor variant="grid" negativeZExtent={15} />

    <InputController scope="canvas">
      <Action id="inner-next" type="carousel.next" layoutId="inner-carousel" stepSlides={1}>
        <KeyMap keyName="ArrowRight" />
      </Action>
      <Action id="inner-prev" type="carousel.prev" layoutId="inner-carousel" stepSlides={1}>
        <KeyMap keyName="ArrowLeft" />
      </Action>
    </InputController>

    <ViewLayout id="inner-carousel" kind="carousel" loop focusedIndex={0} zStep={8} fadeMin={0.3}>
      <View id="inner-1" w={0.4} h={0.5}>
        <BarChart id="inner-bar" data={innerData1} x={0} y={0} w={1} h={1} depth={0.25}>
          <ChartData keyField="label" />
          <ChartAxis axis="x" field="label" label="Day" />
          <ChartAxis axis="y" field="value" label="Count" />
          <ChartSeries field="value" label="Daily" />
        </BarChart>
      </View>
      <View id="inner-2" w={0.4} h={0.5}>
        <LineChart id="inner-line" data={innerData2} x={0} y={0} w={1} h={1}
          lineShape="circle" lineSmoothness={0.5} showPoints depth={0.25}>
          <ChartData keyField="label" />
          <ChartAxis axis="x" field="label" label="Day" />
          <ChartAxis axis="y" field="value" label="Count" />
          <ChartSeries field="value" label="Weekly" />
        </LineChart>
      </View>
      <View id="inner-3" w={0.4} h={0.5}>
        <BarChart id="inner-bar-2" data={innerData3} x={0} y={0} w={1} h={1}
          orientation="horizontal" depth={0.25}>
          <ChartData keyField="label" />
          <ChartAxis axis="x" field="label" label="Day" />
          <ChartAxis axis="y" field="value" label="Amount" />
          <ChartSeries field="value" label="Monthly" />
        </BarChart>
      </View>
      <CarouselTray metalness={0.15} />
    </ViewLayout>
  </Scene>
);

type ExplorerOverlayProps = {
  onClose: () => void;
};

export const ExplorerOverlay = ({ onClose }: ExplorerOverlayProps): JSX.Element => {
  const { plugins } = useMemo(() => createExplorerPlugins(), []);
  const theme = useMemo((): ActiveTheme => ({ family: 'darkGlass', polarity: 'dark' }), []);

  return (
    <div className="ex-overlay">
      <FullScreenCloseButton onClick={onClose} />
      <div style={{ flex: 1, position: 'relative' }}>
        <SceneEngine plugins={plugins} theme={theme}>
          <InnerPickerScene />
          <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={400}>
            <EngineARContainer aspectRatio={16 / 9} scaleMode="fit-width">
              <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
              <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
              <EngineOverlayHost />
            </EngineARContainer>
            <InputCoordinator inertiaSensitivity={0.012} inertiaDecay={0.85} />
          </ScrollStage>
        </SceneEngine>
      </div>
    </div>
  );
};
