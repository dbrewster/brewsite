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

// Camera placed at z=7, fov=45 for full chart visibility.
// After the centering fix, a chart with bounds {w:4, h:3} has its content spanning
// [-2..2, -1.5..1.5] relative to chartGroup. At distance 7 with fov=45:
// half-width = 7 * tan(22.5°) ≈ 2.9 — the full 4-unit chart width fits in frame.
const CHART_CAM_POS: [number, number, number] = [2, 1.5, 7];
const CHART_CAM_TGT: [number, number, number] = [2, 1.5, 0];
const CHART_CAM_FOV = 45;

// Pie uses square bounds {w:4, h:4} — use a centered camera at (2, 2).
const PIE_CAM_POS: [number, number, number] = [2, 2, 8];
const PIE_CAM_TGT: [number, number, number] = [2, 2, 0];
const PIE_CAM_FOV = 45;

const SceneLighting = (): JSX.Element => (
  <Lighting intensityScale={1.2}>
    <Ambient intensity={0.8} color="#c4d4ff" />
    <Directional intensity={0.9} color="#99bbff" position={[-4, 10, 7]} />
    <Directional intensity={0.5} color="#ff9955" position={[8, 3, 5]} />
  </Lighting>
);

// ─── Scene 1: Bar — monthly revenue vs. costs ─────────────────────────────────

export const chartDemoBar: JSX.Element = (
  <Scene id="chart-demo-bar" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.3] }}>
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={CHART_CAM_POS} target={CHART_CAM_TGT} fov={CHART_CAM_FOV} />
    <SceneLighting />
    <Background color="#020812" />

    <Chart
      id="bar-revenue"
      type="bar"
      theme="darkGlass"
      bounds={{ width: .4, height: .3, depth: 0.45 }}
    >
      <ChartData source="monthly" />
      <ChartAxis axis="x" field="month" label="Month" />
      <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartSeries field="costs"   label="Costs" />
      <ChartLegend visible position="right" />
    </Chart>

    <TextBox id="bar-title" x={0.04} y={0.04} w={0.5} h={0.12}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
        <span style={{ fontSize: '11px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
          Chart Demo
        </span>
        <h2 style={{ fontSize: '24px', color: '#fff', margin: '4px 0 0' }}>
          Monthly Revenue vs. Costs
        </h2>
      </div>
    </TextBox>
  </Scene>
);

// ─── Scene 2: Line — ARR growth trend ────────────────────────────────────────

export const chartDemoLine: JSX.Element = (
  <Scene id="chart-demo-line" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.3] }}>
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={CHART_CAM_POS} target={CHART_CAM_TGT} fov={CHART_CAM_FOV} />
    <SceneLighting />
    <Background color="#020812" />

    <Chart
      id="line-arr"
      type="line"
      theme="darkGlass"
      bounds={{ width: .4, height: .3, depth: 0.3 }}
    >
      <ChartData source="monthly" />
      <ChartAxis axis="x" field="month" label="Month" />
      <ChartAxis axis="y" field="arr"   label="ARR ($k)" />
      <ChartSeries field="arr" label="Annual Recurring Revenue" />
      <ChartLegend visible position="right" />
    </Chart>

    <TextBox id="line-title" x={0.04} y={0.04} w={0.5} h={0.12}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
        <span style={{ fontSize: '11px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
          Chart Demo
        </span>
        <h2 style={{ fontSize: '24px', color: '#fff', margin: '4px 0 0' }}>
          ARR Growth Trend
        </h2>
      </div>
    </TextBox>
  </Scene>
);

// ─── Scene 3: Pie — revenue by product ───────────────────────────────────────

export const chartDemoPie: JSX.Element = (
  <Scene id="chart-demo-pie" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.3] }}>
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={PIE_CAM_POS} target={PIE_CAM_TGT} fov={PIE_CAM_FOV} />
    <SceneLighting />
    <Background color="#020812" />

    <Chart
      id="pie-products"
      type="pie"
      theme="darkGlass"
      bounds={{ width: .4, height: .4, depth: 0.5 }}
    >
      <ChartData source="products" />
      <ChartAxis axis="x" field="product" label="Product" />
      <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
      <ChartSeries field="revenue" label="Revenue" />
    </Chart>

    <TextBox id="pie-title" x={0.04} y={0.04} w={0.5} h={0.12}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
        <span style={{ fontSize: '11px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
          Chart Demo
        </span>
        <h2 style={{ fontSize: '24px', color: '#fff', margin: '4px 0 0' }}>
          Revenue by Product
        </h2>
      </div>
    </TextBox>
  </Scene>
);

// ─── Scene 4: Scatter — team size vs. quarterly revenue ──────────────────────

export const chartDemoScatter: JSX.Element = (
  <Scene id="chart-demo-scatter" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.3] }}>
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={CHART_CAM_POS} target={CHART_CAM_TGT} fov={CHART_CAM_FOV} />
    <SceneLighting />
    <Background color="#020812" />

    <Chart
      id="scatter-teams"
      type="scatter"
      theme="darkGlass"
      bounds={{ width: .4, height: .3, depth: 0.3 }}
    >
      <ChartData source="teams" />
      <ChartAxis axis="x" field="teamSize"     label="Team Size" />
      <ChartAxis axis="y" field="quarterlyRev" label="Quarterly Revenue ($k)" />
      <ChartSeries field="quarterlyRev" label="Revenue" />
      <ChartLegend visible position="right" />
    </Chart>

    <TextBox id="scatter-title" x={0.04} y={0.04} w={0.5} h={0.12}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
        <span style={{ fontSize: '11px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
          Chart Demo
        </span>
        <h2 style={{ fontSize: '24px', color: '#fff', margin: '4px 0 0' }}>
          Team Size vs. Quarterly Revenue
        </h2>
      </div>
    </TextBox>
  </Scene>
);
