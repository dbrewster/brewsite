import type { JSX } from 'react';
import {
  Action, Ambient, Camera, CarouselTray, Directional, Floor, Highlight,
  InputController, KeyMap, Lighting, PointerMap, ProgressManager,
  Scene, TextBox, View, ViewLayout,
  type CarouselSelectEvent,
} from '@brewsite/core';
import { BarChart, ChartAxis, ChartData, ChartSeries } from '@brewsite/charts';
import {
  Diagram, DiagramEdge, DiagramGroup, DiagramNode, FlowLayout,
} from '@brewsite/diagram';
import { revenueData } from '../data/sampleData';

const CAM_POS: [number, number, number] = [0, 1.2, 7];
const CAM_TGT: [number, number, number] = [0, 0, 0];

type PickerSceneProps = {
  onSelect: (event: CarouselSelectEvent) => void;
};

export const PickerScene = ({ onSelect }: PickerSceneProps): JSX.Element => (
  <Scene id="picker" primaryCarouselId="showcase">
    <ProgressManager scrollUnits={800} />
    <Camera mode="world" position={CAM_POS} target={CAM_TGT} fov={42} />
    <Lighting intensityScale={1.2}>
      <Ambient intensity={2.5} color="#d7e5ff" />
      <Directional intensity={1.2} color="#ffffff" position={[3, 5, 4]} />
    </Lighting>
    <Floor variant="grid" negativeZExtent={20} />

    <InputController scope="canvas">
      <Action id="carousel-next" type="carousel.next" layoutId="showcase" stepSlides={1}>
        <KeyMap keyName="ArrowRight" />
      </Action>
      <Action id="carousel-prev" type="carousel.prev" layoutId="showcase" stepSlides={1}>
        <KeyMap keyName="ArrowLeft" />
      </Action>
    </InputController>

    <ViewLayout
      id="showcase"
      kind="carousel"
      loop
      focusedIndex={0}
      zStep={12}
      fadeMin={0.2}
      spread={0.65}
      x={0.05} w={0.9}
      onSelect={onSelect}
    >
      {/* View 0: Chart preview */}
      <View id="chart-view" w={0.42} h={0.52}>
        <BarChart id="picker-chart" data={revenueData} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="quarter" />
          <ChartAxis axis="x" field="quarter" label="Quarter" />
          <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
          <ChartSeries field="revenue" label="Revenue" />
          <ChartSeries field="costs" label="Costs" />
        </BarChart>
      </View>

      {/* View 1: Diagram preview */}
      <View id="diagram-view" w={0.42} h={0.52}>
        <Diagram id="picker-diagram" x={0} y={0} w={1} h={1} scale={1.2}>
          <FlowLayout direction="top-down" gap={0.06} />
          <DiagramNode id="api" label="API Gateway" sublabel="REST + gRPC" size={[0.22, 0.10]} />
          <DiagramGroup id="services" label="Services" variant="cluster">
            <FlowLayout direction="left-right" gap={0.05} />
            <DiagramNode id="auth" label="Auth" />
            <DiagramNode id="billing" label="Billing" />
            <DiagramNode id="notify" label="Notify" />
          </DiagramGroup>
          <DiagramNode id="db" label="Database" sublabel="PostgreSQL" size={[0.22, 0.10]} />
          <DiagramEdge from="api" to="services" routing="flow" flow="forward" />
          <DiagramEdge from="services" to="db" routing="flow" flow="forward" />
        </Diagram>
      </View>

      {/* View 2: Explorer preview (static card — full content is in overlay) */}
      <View id="explorer-view" w={0.42} h={0.52}>
        <BarChart id="picker-explorer-preview" data={revenueData} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="quarter" />
          <ChartAxis axis="x" field="quarter" label="Quarter" />
          <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
          <ChartSeries field="revenue" label="Revenue" />
        </BarChart>
      </View>

      <CarouselTray metalness={0.1} />
      <Highlight viewId="chart-view" variant="primary" mode="glow" intensity={0.6} />
      <Highlight viewId="diagram-view" variant="warning" mode="holographic" smoke beamHeight={3} />
      <Highlight viewId="explorer-view" variant="error" mode="glow" intensity={0.5} />
    </ViewLayout>

    {/* Title overlay */}
    <TextBox id="picker-title" x={0.02} y={0.04} w={0.35} h={0.10} layer={3}>
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 14px', background: 'rgba(4,12,28,0.85)', backdropFilter: 'blur(14px)',
        borderRadius: 8, border: '1px solid rgba(70,130,220,0.3)', boxSizing: 'border-box',
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#c8deff' }}>
          Selection Carousel
        </div>
        <div style={{ fontSize: 11, color: 'rgba(140,180,255,0.6)' }}>
          Click or press Enter to expand · Esc or ✕ to close
        </div>
      </div>
    </TextBox>
  </Scene>
);
