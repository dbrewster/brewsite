// Scene 3: <ViewLayout kind="carousel"> with three views.
// Three separate <Scene> elements cycle activeIndex 0 → 1 → 2.
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
import {Diagram, DiagramEdge, DiagramGroup, DiagramNode, FlowLayout, GridLayout, useDiagramTheme} from "@brewsite/diagram";
import {config} from "../../settings";

const CAM_POS: [number, number, number] = [0, 1.5, 6.6];
const CAM_TGT: [number, number, number] = [0, 0.08, 0];

const dataA = [
  { category: 'Alpha', score: 72 },
  { category: 'Beta', score: 88 },
  { category: 'Gamma', score: 55 },
];

const dataB = [
  { category: 'Alpha', score: 45 },
  { category: 'Beta', score: 92 },
  { category: 'Gamma', score: 78 },
];

const dataC = [
  { category: 'Alpha', score: 60 },
  { category: 'Beta', score: 40 },
  { category: 'Gamma', score: 95 },
];

/** Shared camera + lighting for all carousel scenes. */
function SharedEnv(): JSX.Element {
  return (
    <>
      <ProgressManager scrollUnits={800} />
      <Camera mode="world" position={CAM_POS} target={CAM_TGT} fov={42} />
      <Lighting intensityScale={1.2}>
        <Ambient intensity={.9} color="#d7e5ff" />
        <Directional intensity={1.0} color="#edf4ff" position={[0, 2, 10]} />
      </Lighting>
    </>
  );
}

/** The views are identical across carousel scenes — only activeIndex changes. */
function CarouselViews(): JSX.Element {
  const chartTheme = useChartTheme();
  const diagramTheme = useDiagramTheme();
  return (
    <>
      <View id="cv1" w={0.4} h={0.8}>
        <BarChart id="carousel-chart-1" data={dataA} theme={chartTheme} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="category" />
          <ChartAxis axis="x" field="category" label="Category" />
          <ChartAxis axis="y" field="score" label="Score A" />
          <ChartSeries field="score" label="Score A" />
        </BarChart>
      </View>
      <View id="cv2" w={0.4} h={0.8}>
        <BarChart id="carousel-chart-2" data={dataB} theme={chartTheme} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="category" />
          <ChartAxis axis="x" field="category" label="Category" />
          <ChartAxis axis="y" field="score" label="Score B" />
          <ChartSeries field="score" label="Score B" />
        </BarChart>
      </View>
      <View id="cv3" w={0.4} h={0.8}>
        <BarChart id="carousel-chart-3" data={dataC} theme={chartTheme} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="category" />
          <ChartAxis axis="x" field="category" label="Category" />
          <ChartAxis axis="y" field="score" label="Score C" />
          <ChartSeries field="score" label="Score C" />
        </BarChart>
      </View>
      <View id="cv4" w={0.4} h={0.8}>
        <BarChart id="carousel-chart-4" data={dataC} theme={chartTheme} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="category" />
          <ChartAxis axis="x" field="category" label="Category" />
          <ChartAxis axis="y" field="score" label="Score C" />
          <ChartSeries field="score" label="Score C" />
        </BarChart>
      </View>
      <View id="cv5" w={0.4} h={0.8}>
        <Diagram id="cf-overview-2" x={0} y={0} w={1} h={1} tilt={config.diagramRotationX} scale={config.diagramScale} theme={diagramTheme}>
          <FlowLayout direction="top-down" gap={1.05} />

          <DiagramNode
            id="cf-db"
            label=".swarm/memory.db"
            sublabel="SQLite · single file · 12 tables"
            size={[8.8, 2.5]}
            color="#1a2030"
            glow={{ intensity: 0.12 }}
          />

          <DiagramGroup id="cf-categories" variant="container">
            <GridLayout columns={2} spacing={[2.4, 1.1]} />

            <DiagramGroup id="cf-core" label="Core Storage" variant="cluster">
              <FlowLayout direction="top-down" gap={0.72} />
              <DiagramNode id="cf-memstore" label="memory_store" sublabel="key-value · namespace · TTL" size={[5.0, 1.55]} color="#101828" />
              <DiagramNode id="cf-sessions" label="sessions" sublabel="cross-session context" size={[5.0, 1.55]} color="#101828" />
              <DiagramNode id="cf-agents" label="agents" sublabel="registry · config · state" size={[5.0, 1.55]} color="#101828" />
              <DiagramNode id="cf-tasks" label="tasks" sublabel="tracking · deps · status" size={[5.0, 1.55]} color="#101828" />
            </DiagramGroup>

            <DiagramGroup id="cf-coord" label="Coordination" variant="cluster">
              <FlowLayout direction="top-down" gap={0.72} />
              <DiagramNode id="cf-shared" label="shared_state" sublabel="cross-agent blackboard · versioned" size={[5.0, 1.55]} color="#101828" />
              <DiagramNode id="cf-agmem" label="agent_memory" sublabel="per-agent state" size={[5.0, 1.55]} color="#101828" />
              <DiagramNode id="cf-events" label="events" sublabel="audit log" size={[5.0, 1.55]} color="#101828" />
              <DiagramNode id="cf-topology" label="swarm_topology" sublabel="agent relationships" size={[5.0, 1.55]} color="#101828" />
            </DiagramGroup>

            <DiagramGroup id="cf-intel" label="Intelligence" variant="cluster">
              <FlowLayout direction="top-down" gap={0.72} />
              <DiagramNode id="cf-patterns" label="patterns" sublabel="usage_count · confidence" size={[5.0, 1.55]} color="#101828" />
              <DiagramNode id="cf-perf" label="performance_metrics" sublabel="latency · throughput" size={[5.0, 1.55]} color="#101828" />
            </DiagramGroup>

            <DiagramGroup id="cf-recov" label="Recovery" variant="cluster">
              <FlowLayout direction="top-down" gap={0.72} />
              <DiagramNode id="cf-workflow" label="workflow_state" sublabel="crash-recovery checkpoints" size={[5.0, 1.55]} color="#101828" />
              <DiagramNode id="cf-consensus" label="consensus_state" sublabel="quorum voting · ≥2 acceptors" size={[5.0, 1.55]} color="#101828" />
            </DiagramGroup>
          </DiagramGroup>

          <DiagramEdge from="cf-db" to="cf-core"  routing="flow"  arrowEnd="none" color="#3a5070" flow='forward' />
          <DiagramEdge from="cf-db" to="cf-coord" routing="flow" arrowEnd="none" color="#3a5070" flow='forward' />
          <DiagramEdge from="cf-db" to="cf-intel" routing="flow" arrowEnd="none" color="#3a5070" flow='forward' />
          <DiagramEdge from="cf-db" to="cf-recov" routing="flow" arrowEnd="none" color="#3a5070" flow='forward' />
        </Diagram>
      </View>
      <View id="cv6" w={0.4} h={0.8}>
        <BarChart id="carousel-chart-6" orientation={'horizontal'} data={dataC} theme={chartTheme} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="category" />
          <ChartAxis axis="x" field="category" label="Category" />
          <ChartAxis axis="y" field="score" label="Score C" />
          <ChartSeries field="score" label="Score C" />
        </BarChart>
      </View>
      <View id="cv7" w={0.4} h={0.8}>
        <LineChart id="carousel-chart-7" data={dataC} theme={chartTheme} x={0} y={0} w={1} h={1}
                   lineShape="circle"
                   lineSmoothness={0.5}
                   showPoints={true}
                   depth={0.3}>
          <ChartData keyField="category" />
          <ChartAxis axis="x" field="category" label="Category" />
          <ChartAxis axis="y" field="score" label="Score C" />
          <ChartSeries field="score" label="Score C" />
        </LineChart>
      </View>
    </>
  );
}

export const CarouselScene1 = (): JSX.Element => (
  <Scene id="carousel-1">
    <SharedEnv />
    <ViewLayout kind="carousel" loop activeIndex={0} zStep={15} fadeMin={0.15} spread={.7}>
      <CarouselViews />
    </ViewLayout>
  </Scene>
);

export const CarouselScene2 = (): JSX.Element => (
  <Scene id="carousel-2">
    <SharedEnv />
    <ViewLayout kind="carousel" loop activeIndex={1} zStep={15} fadeMin={0.15} spread={.7}>
      <CarouselViews />
    </ViewLayout>
  </Scene>
);

export const CarouselScene3 = (): JSX.Element => (
  <Scene id="carousel-3">
    <SharedEnv />
    <ViewLayout kind="carousel" loop activeIndex={4} zStep={15} fadeMin={0.15} spread={.7}>
      <CarouselViews />
    </ViewLayout>
  </Scene>
);
