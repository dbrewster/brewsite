// Scene 3: <ViewLayout kind="carousel"> with three views.
// Three separate <Scene> elements cycle activeIndex 0 → 1 → 2.
import type {JSX} from 'react';
import {
  Action,
  Ambient,
  Camera,
  CarouselTray,
  Floor,
  Highlight,
  InputController,
  KeyMap,
  Lighting,
  type OrbitFn,
  PointerMap,
  ProgressManager,
  Scene,
  Spotlight,
  SpotlightRig,
  View,
  ViewLayout,
} from '@brewsite/core';
import {BarChart, ChartAxis, ChartData, ChartSeries, LineChart,} from '@brewsite/charts';
import {Diagram, DiagramEdge, DiagramGroup, DiagramNode, FlowLayout, GridLayout} from "@brewsite/diagram";

const CAM_POS: [number, number, number] = [0, 1, 6.6];
const CAM_TGT: [number, number, number] = [0, 0, 0];

// ─── Random spotlight configs — computed once, stable across hot reloads ──────

/** Seeded pseudo-random so values are stable across hot reloads. */
const seeded = (seed: number) => {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
};
const rng = seeded(42);

const randColor = (): string => {
  const h = rng() * 360;
  const s = 70 + rng() * 30;
  const l = 50 + rng() * 20;
  const a = s / 100 * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

type SpotlightDef = Pick<import('@brewsite/core').SpotlightProps, 'color' | 'intensity' | 'angle' | 'orbit'>;

const spotlights: SpotlightDef[] = Array.from({ length: 7 }, () => {
  const fX = 0.2 + rng() * 0.6, fY = 0.25 + rng() * 0.5, fZ = 0.15 + rng() * 0.4;
  const aX = 3 + rng() * 5, aY = 2 + rng() * 3, aZ = 1 + rng() * 3;
  const oY = 1 + rng() * 3;
  const pX = rng() * Math.PI * 2, pY = rng() * Math.PI * 2, pZ = rng() * Math.PI * 2;
  return {
    color:     randColor(),
    intensity: 60 + rng() * 50,
    angle:     Math.PI / 28 + rng() * Math.PI / 10,
    orbit:     ((t: number): [number, number, number] => [
      Math.sin(t * fX + pX) * aX,
      Math.sin(t * fY + pY) * aY + oY,
      Math.cos(t * fZ + pZ) * aZ,
    ]) as OrbitFn,
  };
});

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
      <SpotlightRig center={[0, 0, 4]} target={[0, 0, -5]} height={1} showBeam={false} distance={0} decay={1} penumbra={0.5}>
        {spotlights.map((s, i) => <Spotlight key={i} {...s} />)}
      </SpotlightRig>
      <Lighting intensityScale={1.2}>
        <Ambient intensity={.9} color="#d7e5ff" />
      </Lighting>
    </>
  );
}

/** The views are identical across carousel scenes — only activeIndex changes.
 *
 *  View order (indices 0–6): chart, DIAGRAM, chart, chart, chart, chart, chart.
 *  Placing the diagram at index 1 keeps it within one ring step of the chart
 *  scenes (activeIndex 0 and 2), giving z ≈ −2.82 instead of −12.18. */
function CarouselViews(): JSX.Element {
  return (
    <>
      {/* index 0 */}
      <View id="cv1" w={0.4} h={0.5}>
        <BarChart id="carousel-chart-1" data={dataA} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="category" />
          <ChartAxis axis="x" field="category" label="Category" />
          <ChartAxis axis="y" field="score" label="Score A" />
          <ChartSeries field="score" label="Score A" />
        </BarChart>
      </View>
      {/* index 1 — diagram adjacent to charts; ring z-offset ≈−2.8 instead of ≈−12.2 */}
      <View id="cv5" w={0.4} h={0.5}>
        <Diagram id="cf-overview-2" x={0} y={0} w={1} h={1} scale={1.4}>
          <FlowLayout direction="top-down" gap={0.06} />

          <DiagramNode
            id="cf-db"
            label=".swarm/memory.db"
            sublabel="SQLite · single file · 12 tables"
            size={[0.30, 0.10]}
            glow={{ intensity: 0.12 }}
          />

          <DiagramGroup id="cf-categories" variant="container">
            <GridLayout columns={2} spacing={[0.12, 0.06]} />

            <DiagramGroup id="cf-core" label="Core Storage" variant="cluster">
              <FlowLayout direction="top-down" gap={0.04} />
              <DiagramNode id="cf-memstore" label="memory_store" sublabel="key-value · namespace · TTL" size={[0.18, 0.10]}  />
              <DiagramNode id="cf-sessions" label="sessions" sublabel="cross-session context" size={[0.18, 0.10]}  />
              <DiagramNode id="cf-agents" label="agents" sublabel="registry · config · state" size={[0.18, 0.10]}  />
              <DiagramNode id="cf-tasks" label="tasks" sublabel="tracking · deps · status" size={[0.18, 0.10]}  />
            </DiagramGroup>

            <DiagramGroup id="cf-coord" label="Coordination" variant="cluster">
              <FlowLayout direction="top-down" gap={0.04} />
              <DiagramNode id="cf-shared" label="shared_state" sublabel="cross-agent blackboard · versioned" size={[0.18, 0.10]}  />
              <DiagramNode id="cf-agmem" label="agent_memory" sublabel="per-agent state" size={[0.18, 0.10]}  />
              <DiagramNode id="cf-events" label="events" sublabel="audit log" size={[0.18, 0.10]}  />
              <DiagramNode id="cf-topology" label="swarm_topology" sublabel="agent relationships" size={[0.18, 0.10]}  />
            </DiagramGroup>

            <DiagramGroup id="cf-intel" label="Intelligence" variant="cluster">
              <FlowLayout direction="top-down" gap={0.04} />
              <DiagramNode id="cf-patterns" label="patterns" sublabel="usage_count · confidence" size={[0.18, 0.10]}  />
              <DiagramNode id="cf-perf" label="performance_metrics" sublabel="latency · throughput" size={[0.18, 0.10]}  />
            </DiagramGroup>

            <DiagramGroup id="cf-recov" label="Recovery" variant="cluster">
              <FlowLayout direction="top-down" gap={0.04} />
              <DiagramNode id="cf-workflow" label="workflow_state" sublabel="crash-recovery checkpoints" size={[0.18, 0.10]}  />
              <DiagramNode id="cf-consensus" label="consensus_state" sublabel="quorum voting · ≥2 acceptors" size={[0.18, 0.10]}  />
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
        <BarChart id="carousel-chart-2" data={dataB} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="category" />
          <ChartAxis axis="x" field="category" label="Category" />
          <ChartAxis axis="y" field="score" label="Score B" />
          <ChartSeries field="score" label="Score B" />
        </BarChart>
      </View>
      {/* index 3 */}
      <View id="cv3" w={0.4} h={0.5}>
        <BarChart id="carousel-chart-3" data={dataC} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="category" />
          <ChartAxis axis="x" field="category" label="Category" />
          <ChartAxis axis="y" field="score" label="Score C" />
          <ChartSeries field="score" label="Score C" />
        </BarChart>
      </View>
      {/* index 4 */}
      <View id="cv4" w={0.4} h={0.5}>
        <BarChart id="carousel-chart-4" data={dataC} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="category" />
          <ChartAxis axis="x" field="category" label="Category" />
          <ChartAxis axis="y" field="score" label="Score C" />
          <ChartSeries field="score" label="Score C" />
        </BarChart>
      </View>
      {/* index 5 */}
      <View id="cv6" w={0.4} h={0.5}>
        <BarChart id="carousel-chart-6" orientation={'horizontal'} data={dataC} x={0} y={0} w={1} h={1} depth={0.3}>
          <ChartData keyField="category" />
          <ChartAxis axis="x" field="category" label="Category" />
          <ChartAxis axis="y" field="score" label="Score C" />
          <ChartSeries field="score" label="Score C" />
        </BarChart>
      </View>
      {/* index 6 */}
      <View id="cv7" w={0.4} h={0.5}>
        <LineChart id="carousel-chart-7" data={dataC} x={0} y={0} w={1} h={1}
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
  return (
    <Scene id="carousel-1" primaryCarouselId="carousel-1-layout">
      <SharedEnv />
      <InputController scope="canvas">
        <Action id="default-carousel-next" type="carousel.next" layoutId='carousel-1-layout' stepSlides={1}>
          <KeyMap keyName="ArrowRight" />
          <PointerMap event="click" />
        </Action>
        <Action id="carousel-next-skip" type="carousel.next" layoutId={'carousel-1-layout'} stepSlides={2}>
          <KeyMap keyName="ArrowRight" modifiers={['shift']} />
        </Action>
        <Action id="default-carousel-prev" type="carousel.prev" layoutId={'carousel-1-layout'} stepSlides={1}>
          <KeyMap keyName="ArrowLeft" />
        </Action>
        <Action id="carousel-prev-skip" type="carousel.prev" layoutId={'carousel-1-layout'} stepSlides={2}>
          <KeyMap keyName="ArrowLeft" modifiers={['shift']} />
        </Action>
      </InputController>

      <ViewLayout id="carousel-1-layout" kind="carousel" loop activeIndex={0} zStep={15} fadeMin={0.15} spread={.7} >
        <CarouselViews />
        <CarouselTray metalness={.1} />
        <Highlight viewId='cv5' mode="holographic" color="#E36A2E" smoke />
      </ViewLayout>
    </Scene>
  );
};
