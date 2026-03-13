// Scene 3: <ViewLayout kind="carousel"> with three views.
// Three separate <Scene> elements cycle activeIndex 0 → 1 → 2.
import type { JSX } from 'react';
import {
  Action,
  Camera,
  InputController,
  KeyMap,
  Lighting,
  Ambient,
  Directional,
  PointerMap,
  ProgressManager,
  Scene,
  View,
  ViewLayout, Floor, SpotlightRig,
} from '@brewsite/core';
import {
  BarChart,
  ChartData,
  ChartAxis,
  ChartSeries,
  useChartTheme,
  LineChart,
  type ChartTheme,
} from '@brewsite/charts';
import {Diagram, DiagramEdge, DiagramGroup, DiagramNode, FlowLayout, GridLayout, useDiagramTheme, type DiagramTheme} from "@brewsite/diagram";

const CAM_POS: [number, number, number] = [0, 1, 6.6];
const CAM_TGT: [number, number, number] = [0, 0, 0];

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
      <Floor variant='grid' negativeZExtent={20}/>
      <Camera mode="world" position={CAM_POS} target={CAM_TGT} fov={42} />
      <SpotlightRig
        count={5}
        center={[0, 0, 10]}          // orbit circle centered at z=4
        target={[0, 0, -20]}         // all beams converge toward z=-4
        height={1}                   // light sources at y=6 (above center)
        radius={7}                   // orbit spread — 5 lights in a 4-unit ring
        speed={0.9}                  // your existing speed
        angle={Math.PI / 4}        // ~7.5° half-angle — tight beams
        penumbra={0.4}               // soft falloff at edges
        intensity={100}              // bright enough to visibly illuminate
        distance={20}                // reach: sqrt(8² + 6²) ≈ 10, give headroom
        castShadow
        shadowMapSize={2048}
        beamOpacity={0.00}           // subtle visible cones
        beamColor="#e8f0ff"          // cool white
      />
      <Lighting intensityScale={1.2}>
        <Ambient intensity={.9} color="#d7e5ff" />
      </Lighting>
    </>
  );
}

/** The views are identical across carousel scenes — only activeIndex changes.
 *  Themes are passed as props (not via hooks) because the compiler expands this
 *  component as a plain function call — hooks would throw outside React's render.
 *
 *  View order (indices 0–6): chart, DIAGRAM, chart, chart, chart, chart, chart.
 *  Placing the diagram at index 1 keeps it within one ring step of the chart
 *  scenes (activeIndex 0 and 2), giving z ≈ −2.82 instead of −12.18. */
function CarouselViews({ chartTheme, diagramTheme }: {
  chartTheme: ChartTheme | undefined;
  diagramTheme: DiagramTheme | undefined;
}): JSX.Element {
  return (
    <>
      {/* index 0 */}
      <View id="cv1" w={0.4} h={0.5}>
        <BarChart id="carousel-chart-1" data={dataA} theme={chartTheme} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="category" />
          <ChartAxis axis="x" field="category" label="Category" />
          <ChartAxis axis="y" field="score" label="Score A" />
          <ChartSeries field="score" label="Score A" />
        </BarChart>
      </View>
      {/* index 1 — diagram adjacent to charts; ring z-offset ≈−2.8 instead of ≈−12.2 */}
      <View id="cv5" w={0.4} h={0.5}>
        <Diagram id="cf-overview-2" x={0} y={0} w={1} h={1} theme={diagramTheme} scale={1.4}>
          <FlowLayout direction="top-down" gap={1.05} />

          <DiagramNode
            id="cf-db"
            label=".swarm/memory.db"
            sublabel="SQLite · single file · 12 tables"
            size={[8.8, 2.5]}
            glow={{ intensity: 0.12 }}
          />

          <DiagramGroup id="cf-categories" variant="container">
            <GridLayout columns={2} spacing={[2.4, 1.1]} />

            <DiagramGroup id="cf-core" label="Core Storage" variant="cluster">
              <FlowLayout direction="top-down" gap={0.72} />
              <DiagramNode id="cf-memstore" label="memory_store" sublabel="key-value · namespace · TTL" size={[5.0, 1.55]}  />
              <DiagramNode id="cf-sessions" label="sessions" sublabel="cross-session context" size={[5.0, 1.55]}  />
              <DiagramNode id="cf-agents" label="agents" sublabel="registry · config · state" size={[5.0, 1.55]}  />
              <DiagramNode id="cf-tasks" label="tasks" sublabel="tracking · deps · status" size={[5.0, 1.55]}  />
            </DiagramGroup>

            <DiagramGroup id="cf-coord" label="Coordination" variant="cluster">
              <FlowLayout direction="top-down" gap={0.72} />
              <DiagramNode id="cf-shared" label="shared_state" sublabel="cross-agent blackboard · versioned" size={[5.0, 1.55]}  />
              <DiagramNode id="cf-agmem" label="agent_memory" sublabel="per-agent state" size={[5.0, 1.55]}  />
              <DiagramNode id="cf-events" label="events" sublabel="audit log" size={[5.0, 1.55]}  />
              <DiagramNode id="cf-topology" label="swarm_topology" sublabel="agent relationships" size={[5.0, 1.55]}  />
            </DiagramGroup>

            <DiagramGroup id="cf-intel" label="Intelligence" variant="cluster">
              <FlowLayout direction="top-down" gap={0.72} />
              <DiagramNode id="cf-patterns" label="patterns" sublabel="usage_count · confidence" size={[5.0, 1.55]}  />
              <DiagramNode id="cf-perf" label="performance_metrics" sublabel="latency · throughput" size={[5.0, 1.55]}  />
            </DiagramGroup>

            <DiagramGroup id="cf-recov" label="Recovery" variant="cluster">
              <FlowLayout direction="top-down" gap={0.72} />
              <DiagramNode id="cf-workflow" label="workflow_state" sublabel="crash-recovery checkpoints" size={[5.0, 1.55]}  />
              <DiagramNode id="cf-consensus" label="consensus_state" sublabel="quorum voting · ≥2 acceptors" size={[5.0, 1.55]}  />
            </DiagramGroup>
          </DiagramGroup>

          <DiagramEdge from="cf-db" to="cf-core"  routing="flow"  arrowEnd="none" color="#3a5070" flow='forward' />
          <DiagramEdge from="cf-db" to="cf-coord" routing="flow" arrowEnd="none" color="#3a5070" flow='forward' />
          <DiagramEdge from="cf-db" to="cf-intel" routing="flow" arrowEnd="none" color="#3a5070" flow='forward' />
          <DiagramEdge from="cf-db" to="cf-recov" routing="flow" arrowEnd="none" color="#3a5070" flow='forward' />
        </Diagram>
      </View>
      {/* index 2 */}
      <View id="cv2" w={0.4} h={0.5}>
        <BarChart id="carousel-chart-2" data={dataB} theme={chartTheme} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="category" />
          <ChartAxis axis="x" field="category" label="Category" />
          <ChartAxis axis="y" field="score" label="Score B" />
          <ChartSeries field="score" label="Score B" />
        </BarChart>
      </View>
      {/* index 3 */}
      <View id="cv3" w={0.4} h={0.5}>
        <BarChart id="carousel-chart-3" data={dataC} theme={chartTheme} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="category" />
          <ChartAxis axis="x" field="category" label="Category" />
          <ChartAxis axis="y" field="score" label="Score C" />
          <ChartSeries field="score" label="Score C" />
        </BarChart>
      </View>
      {/* index 4 */}
      <View id="cv4" w={0.4} h={0.5}>
        <BarChart id="carousel-chart-4" data={dataC} theme={chartTheme} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="category" />
          <ChartAxis axis="x" field="category" label="Category" />
          <ChartAxis axis="y" field="score" label="Score C" />
          <ChartSeries field="score" label="Score C" />
        </BarChart>
      </View>
      {/* index 5 */}
      <View id="cv6" w={0.4} h={0.5}>
        <BarChart id="carousel-chart-6" orientation={'horizontal'} data={dataC} theme={chartTheme} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="category" />
          <ChartAxis axis="x" field="category" label="Category" />
          <ChartAxis axis="y" field="score" label="Score C" />
          <ChartSeries field="score" label="Score C" />
        </BarChart>
      </View>
      {/* index 6 */}
      <View id="cv7" w={0.4} h={0.5}>
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

// Scene activeIndex values match the view order above:
//   index 0 → cv1 (chart),  index 1 → cv5 (diagram),  index 2–6 → charts
// Diagram is adjacent to chart scenes so the ring z-offset is ≈−2.8 (one step),
// not ≈−12.2 (four steps apart as it was before).

export const CarouselScene1 = (): JSX.Element => {
  const chartTheme = useChartTheme();
  const diagramTheme = useDiagramTheme();
  return (
    <Scene id="carousel-1">
      <SharedEnv />
      <ViewLayout kind="carousel" loop activeIndex={0} zStep={15} fadeMin={0.15} spread={.7} >
        <CarouselViews chartTheme={chartTheme} diagramTheme={diagramTheme} />
      </ViewLayout>
    </Scene>
  );
};

export const CarouselScene2 = (): JSX.Element => {
  const chartTheme = useChartTheme();
  const diagramTheme = useDiagramTheme();
  return (
    <Scene id="carousel-2">
      <SharedEnv />
      <ViewLayout kind="carousel" loop activeIndex={1} zStep={15} fadeMin={0.15} spread={.7}>
        <CarouselViews chartTheme={chartTheme} diagramTheme={diagramTheme} />
      </ViewLayout>
    </Scene>
  );
};

export const CarouselScene3 = (): JSX.Element => {
  const chartTheme = useChartTheme();
  const diagramTheme = useDiagramTheme();
  return (
    <Scene id="carousel-3">
      <SharedEnv />
      <ViewLayout kind="carousel" loop activeIndex={2} zStep={15} fadeMin={0.15} spread={.7}>
        <CarouselViews chartTheme={chartTheme} diagramTheme={diagramTheme} />
      </ViewLayout>
    </Scene>
  );
};

/** Interactive carousel scene — arrow keys and clicks advance/rewind slides.
 *  carousel.next: ArrowRight or click to advance one slide.
 *  carousel.prev: ArrowLeft to go back one slide.
 *  The ViewLayout id="demo-carousel" matches the layoutId on each Action. */
export const CarouselScene = (): JSX.Element => {
  const chartTheme = useChartTheme();
  const diagramTheme = useDiagramTheme();
  return (
    <Scene id="carousel-interactive">
      <ProgressManager scrollUnits={800} />
      <Camera mode="world" position={CAM_POS} target={CAM_TGT} fov={42} />
      <Lighting intensityScale={1.2}>
        <Ambient intensity={.9} color="#d7e5ff" />
        <Directional intensity={1.0} color="#edf4ff" position={[0, 2, 10]} />
      </Lighting>
      <InputController scope="canvas">
        <Action id="carousel-next" type="carousel.next" layoutId="demo-carousel" stepSlides={1}>
          <KeyMap keyName="ArrowRight" />
          <PointerMap event="click" />
        </Action>
        <Action id="carousel-prev" type="carousel.prev" layoutId="demo-carousel" stepSlides={1}>
          <KeyMap keyName="ArrowLeft" />
        </Action>
      </InputController>
      <ViewLayout id="demo-carousel" kind="carousel" loop activeIndex={0} zStep={15} fadeMin={0.15} spread={0.7}>
        <CarouselViews chartTheme={chartTheme} diagramTheme={diagramTheme} />
      </ViewLayout>
    </Scene>
  );
};
