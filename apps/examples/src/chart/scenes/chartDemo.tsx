// Chart demo scenes — bar, line, pie, and scatter examples with real business data.
import type {JSX} from 'react';
import {Ambient, Background, Camera, Directional, Lighting, ProgressManager, Scene, TextBox,} from '@brewsite/core';
import {Chart, ChartAxis, ChartData, ChartLegend, ChartSeries,} from '@brewsite/charts';

// ─── Sample data ─────────────────────────────────────────────────────────────

/** Monthly SaaS metrics — used by bar + line scenes. */
export const monthlySaasData = [
  { month: 'Jan', revenue: 128, costs: 87,  arr: 1536 },
  { month: 'Feb', revenue: 145, costs: 94,  arr: 1740 },
  { month: 'Mar', revenue: 132, costs: 88,  arr: 1584 },
  { month: 'Apr', revenue: 168, costs: 107, arr: 2016 },
  { month: 'May', revenue: 195, costs: 121, arr: 2340 },
  { month: 'Jun', revenue: 184, costs: 115, arr: 2208 },
  { month: 'Jul', revenue: 212, costs: 130, arr: 2544 },
  { month: 'Aug', revenue: 231, costs: 142, arr: 2772 },
  { month: 'Sep', revenue: 248, costs: 149, arr: 2976 },
  { month: 'Oct', revenue: 267, costs: 161, arr: 3204 },
  { month: 'Nov', revenue: 289, costs: 174, arr: 3468 },
  { month: 'Dec', revenue: 314, costs: 188, arr: 3768 },
];

/** Product revenue breakdown — used by the pie scene. */
export const productRevenueData = [
  { product: 'Core Platform', revenue: 520 },
  { product: 'Diagram SDK',   revenue: 285 },
  { product: 'Charts SDK',    revenue: 198 },
  { product: 'Model SDK',     revenue: 162 },
  { product: 'Services',      revenue:  92 },
];

/** Team performance data — used by the scatter scene. */
export const teamPerformanceData = [
  { teamSize:  3, quarterlyRev: 142 },
  { teamSize:  5, quarterlyRev: 228 },
  { teamSize:  4, quarterlyRev: 185 },
  { teamSize:  8, quarterlyRev: 378 },
  { teamSize:  6, quarterlyRev: 292 },
  { teamSize: 12, quarterlyRev: 541 },
  { teamSize:  7, quarterlyRev: 335 },
  { teamSize: 10, quarterlyRev: 462 },
  { teamSize:  9, quarterlyRev: 415 },
  { teamSize: 15, quarterlyRev: 698 },
];

// ─── Shared scene config ──────────────────────────────────────────────────────

// Charts are centered on the NVS origin, so the demo camera must frame world origin.
// The earlier [2, 1.5] target was for the pre-centering coordinate system and left the
// chart off-camera even though it compiled and rendered correctly.
const CHART_CAM_POS: [number, number, number] = [0, 0.12, 6.6];
const CHART_CAM_TGT: [number, number, number] = [0, 0.08, 0];
const CHART_CAM_FOV = 42;

// Pie charts use the same centered origin, just with a slightly longer camera distance.
const PIE_CAM_POS: [number, number, number] = [0, 0.12, 7.3];
const PIE_CAM_TGT: [number, number, number] = [0, 0.08, 0];
const PIE_CAM_FOV = 42;
const TITLE_LAYOUT = { x: 0.08, y: 0.05, w: 0.48, h: 0.14 } as const;
const CHART_LAYOUT = { x: 0.15, y: 0.18, w: 0.7, h: 0.58 } as const;
const PIE_LAYOUT = { x: 0.18, y: 0.16, w: 0.64, h: 0.64 } as const;

const SceneLighting = (): JSX.Element => (
  <Lighting intensityScale={1.35}>
    <Ambient intensity={0.95} color="#d7e5ff" />
    <Directional intensity={1.1} color="#edf4ff" position={[-5, 7, 10]} />
    <Directional intensity={0.72} color="#59cfff" position={[6, 1, 7]} />
    <Directional intensity={0.42} color="#ffb36b" position={[-7, -1, 5]} />
  </Lighting>
);

// ─── Scene 1: Bar — monthly revenue vs. costs ─────────────────────────────────

export const ChartDemoBar = () => (
  <Scene id="chart-demo-bar" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.0] }}>
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={CHART_CAM_POS} target={CHART_CAM_TGT} fov={CHART_CAM_FOV} />
    <SceneLighting />

    <Chart
      id="bar-revenue"
      type="bar"
      theme={theme}
      x={CHART_LAYOUT.x}
      y={CHART_LAYOUT.y}
      w={CHART_LAYOUT.w}
      h={CHART_LAYOUT.h}
      bounds={{ width: 0.4, height: 0.3, depth: 0.45 }}
    >
      <ChartData source="monthly" />
      <ChartAxis axis="x" field="month" label="Month" />
      <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartSeries field="costs"   label="Costs" />
      <ChartLegend visible position="right" />
    </Chart>

    <TextBox key="bar-title-box" id="bar-title" x={TITLE_LAYOUT.x} y={TITLE_LAYOUT.y} w={TITLE_LAYOUT.w} h={TITLE_LAYOUT.h}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', padding: '0 8px' }}>
        <span style={{ fontSize: '11px', letterSpacing: '0.14em', color: 'rgba(196,222,255,0.55)', textTransform: 'uppercase' }}>
          Chart Demo
        </span>
        <h2 style={{ fontSize: '26px', color: '#f6fbff', margin: '6px 0 0', lineHeight: 1.05 }}>
          Monthly Revenue vs. Costs
        </h2>
      </div>
    </TextBox>
  </Scene>
);

// ─── Scene 2: Line — ARR growth trend ────────────────────────────────────────

export const ChartDemoLine = () => (
  <Scene id="chart-demo-line" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.0] }}>
    <ProgressManager scrollUnits={1200} />

    <Chart
      id="line-arr"
      type="line"
      theme={theme}
      x={CHART_LAYOUT.x}
      y={CHART_LAYOUT.y}
      w={CHART_LAYOUT.w}
      h={CHART_LAYOUT.h}
      bounds={{ width: 0.4, height: 0.3, depth: 0.3 }}
      lineShape='triangle'
    >
      <ChartData source="monthly" />
      <ChartAxis axis="x" field="month" label="Month" />
      <ChartAxis axis="y" field="arr"   label="ARR ($k)" />
      <ChartSeries field="arr" label="Annual Recurring Revenue" />
      <ChartLegend visible position="right" />
    </Chart>

    <TextBox key="line-title-box" id="line-title" x={TITLE_LAYOUT.x} y={TITLE_LAYOUT.y} w={TITLE_LAYOUT.w} h={TITLE_LAYOUT.h}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', padding: '0 8px' }}>
        <span style={{ fontSize: '11px', letterSpacing: '0.14em', color: 'rgba(196,222,255,0.55)', textTransform: 'uppercase' }}>
          Chart Demo
        </span>
        <h2 style={{ fontSize: '26px', color: '#f6fbff', margin: '6px 0 0', lineHeight: 1.05 }}>
          ARR Growth Trend
        </h2>
      </div>
    </TextBox>
  </Scene>
);

// ─── Scene 3: Pie — revenue by product ───────────────────────────────────────

export const ChartDemoPie = () => (
  <Scene id="chart-demo-pie" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.3] }}>
    <ProgressManager scrollUnits={1200} />

    <Chart
      id="pie-products"
      type="pie"
      theme={theme}
      x={PIE_LAYOUT.x}
      y={PIE_LAYOUT.y}
      w={PIE_LAYOUT.w}
      h={PIE_LAYOUT.h}
      bounds={{ width: 0.4, height: 0.4, depth: 0.5 }}
    >
      <ChartData source="products" />
      <ChartAxis axis="x" field="product" label="Product" />
      <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartLegend visible position="right" />
    </Chart>

    <TextBox key="pie-title-box" id="pie-title" x={TITLE_LAYOUT.x} y={TITLE_LAYOUT.y} w={TITLE_LAYOUT.w} h={TITLE_LAYOUT.h}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', padding: '0 8px' }}>
        <span style={{ fontSize: '11px', letterSpacing: '0.14em', color: 'rgba(196,222,255,0.55)', textTransform: 'uppercase' }}>
          Chart Demo
        </span>
        <h2 style={{ fontSize: '26px', color: '#f6fbff', margin: '6px 0 0', lineHeight: 1.05 }}>
          Revenue by Product
        </h2>
      </div>
    </TextBox>
  </Scene>
);

// ─── Scene 4: Scatter — team size vs. quarterly revenue ──────────────────────

export const ChartDemoScatter = () => (
  <Scene id="chart-demo-scatter" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.0] }}>

    <Chart
      id="scatter-teams"
      type="scatter"
      theme={theme}
      x={CHART_LAYOUT.x}
      y={CHART_LAYOUT.y}
      w={CHART_LAYOUT.w}
      h={CHART_LAYOUT.h}
      bounds={{ width: 0.4, height: 0.3, depth: 0.3 }}
    >
      <ChartData source="teams" />
      <ChartAxis axis="x" field="teamSize"     label="Team Size" />
      <ChartAxis axis="y" field="quarterlyRev" label="Quarterly Revenue ($k)" />
      <ChartSeries field="quarterlyRev" label="Revenue" />
      <ChartLegend visible position="right" />
    </Chart>

    <TextBox key="scatter-title-box" id="scatter-title" x={TITLE_LAYOUT.x} y={TITLE_LAYOUT.y} w={TITLE_LAYOUT.w} h={TITLE_LAYOUT.h}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', padding: '0 8px' }}>
        <span style={{ fontSize: '11px', letterSpacing: '0.14em', color: 'rgba(196,222,255,0.55)', textTransform: 'uppercase' }}>
          Chart Demo
        </span>
        <h2 style={{ fontSize: '26px', color: '#f6fbff', margin: '6px 0 0', lineHeight: 1.05 }}>
          Team Size vs. Quarterly Revenue
        </h2>
      </div>
    </TextBox>
  </Scene>
);
