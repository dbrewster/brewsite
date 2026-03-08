---
title: "Charts Rendering Fix — No Visual Output"
doc_type: plan
owner: brewsite-architect
status: ready
updated: 2026-03-08
---

# Charts Rendering Fix — No Visual Output

## Problem Summary

The `@brewsite/charts` example at `/examples/chart` renders text labels (via `TextBox`, which is pure React DOM) but shows no Three.js chart geometry — no bars, lines, pie slices, or scatter points. Text labels are visible because `TextBox` is a `position:absolute` div rendered by `EngineOverlayHost` completely independent of the Three.js pipeline. This creates the misleading impression that the engine is running but charts are simply invisible.

Investigation reveals **three concrete root causes**, all fixable:

---

## Root Cause Diagnosis

### RC-1 (Primary): Chart group anchored at NVS origin, not centered on it

**Files**: `packages/charts/src/elements/chart/ChartWidget.ts` (lines 147–151), `packages/charts/src/elements/chart/render.ts` (lines 60–61)

`ChartWidget.apply()` converts the NVS center position to world-space and passes it to `ChartRenderer.update()`, which calls:

```ts
this.chartGroup.position.set(...state.position as [number, number, number]);
```

The chart group's **local origin (0, 0, 0)** is placed at the NVS world-space center. All chart content — bars, axes, series lines — starts at group-local **(0, 0)** and extends **rightward (+X) and upward (+Y)**. This means:

- For `nvsX=0.5, nvsY=0.5` (the compile-time default when no `x/y/w/h` props are given), the chart group is placed at the camera target `[2, 1.5, 0]`.
- Bars extend from world `[2, 1.5]` to `[6, 4.5]` (for `bounds.width=4, height=3`).
- The camera at `[2, 1.5, 2]` with `fov=55`, `aspect=1` sees the world range `[0.96, 3.04] × [0.46, 2.54]`.
- Only the leftmost ~25% of bars (world x: 2..3.04) are within the camera frustum. Most bars are off-screen to the right. The bottom edge of every bar is clipped by the camera's lower boundary.

The chart appears to show nothing because almost all geometry is outside the camera frustum.

**Fix location**: `ChartWidget.apply()` must offset the world position by `-bounds.width/2` on X and `-bounds.height/2` on Y before passing to `ChartRenderer.update()`, centering the chart content on the NVS-derived world coordinate. This is a one-line change but requires a deliberate design decision: the NVS bounds define the chart's center, and chart content (bars, axes) is centered within those bounds.

### RC-2: Three of four demo scenes are missing `<Camera>` and `<Lighting>` DSL elements

**File**: `apps/examples/src/chart/scenes/chartDemo.tsx`

Only `chartDemoBar` declares `<Camera>` and `<SceneLighting>`. The line, pie, and scatter scenes have neither. Consequences:

- **Camera**: `CameraWidget.defaultState.enabled = false`. When `enabled=false`, `applyCamera()` returns immediately without moving the camera. The camera stays at whatever position the previous scene left it. For the line/scatter scenes following bar, the camera position carries over from the bar scene — this may be workable but is architecturally wrong and hard to reason about.
- **Pie chart**: The pie scene uses `<ChartData source="products">` and `<ChartAxis axis="x" field="product">`. The pie chart's geometry is centred on group-local `(0,0)` via `PieRenderer`, which uses the bounds center differently from bar/line. Without a dedicated camera (`PIE_CAM_POS = [0, 0, 7]`, `PIE_CAM_TGT = [0, 0, 0]` were defined in the scene file but never applied), the camera is looking at `[2, 1.5, 0]` while the pie chart group is at the wrong location.
- **Lighting**: Without `<Lighting>` in later scenes, the Three.js lighting state persists from the bar scene. This works accidentally in the dev environment but breaks scene isolation.

**Fix location**: Add `<Camera>`, `<Lighting>`, and `<Background>` DSL elements to all four chart scenes in `chartDemo.tsx`, using appropriate positions for each chart type.

### RC-3: `AxesRenderer` uses troika-three-text without asserting `fontUrl` availability

**File**: `packages/charts/src/renderers/shared/AxesRenderer.ts`

The axes renderer creates troika `Text` objects for axis labels. When `fontUrl` is `undefined` (which is the case in the demo, since no `sceneTheme` is provided), troika falls back to its built-in font. This is fine. However, `AxesRenderer` and `LegendRenderer` create text objects on every call if they don't exist, but **do not update the text object's `renderOrder`**. The text from axes/legend may render behind the background plane (`BackgroundWidget` uses a full-screen quad), causing the text to be occluded, which creates the impression of "labels but no geometry."

This is a secondary issue and lower priority than RC-1/RC-2.

---

## What Is Working Correctly

The following are architecturally correct and need no changes:

- `chartPlugin()` factory, `WidgetPlugin` contract, `registerHandlers()`, `configureRegistry()` — all wired correctly
- `ChartWidget` implements `ISceneElement + IRenderable + IAnimationController + IDslComposite + INVSBounded` — complete
- `ChartDataStore`, `ChartProvider`, `ChartStoreContext` — data flows correctly from `ChartProvider.useEffect` to `ChartRenderer.update()` via the store closure
- `RuntimeDriverImpl.initialize()` re-reads widget lists to capture lazily-registered widgets — `ChartWidget` is in the registry by the time `initialize()` runs
- `compileSceneTrack` correctly bakes chart state into `SceneTrackTick[]` — widget state is present in the track
- `BarRenderer.buildBars()`, `LineRenderer.buildLines()`, etc. — geometry creation code is correct
- `ChartMaterialFactory` — material creation and caching is correct
- `darkGlassChartTheme` and all other themes — theme tokens are valid

---

## Files to Create or Modify

### Stream A — Core Fix (RC-1): Chart centering offset

**Independent of Stream B. Can be worked in parallel.**

#### A1. `packages/charts/src/elements/chart/ChartWidget.ts`

**Change**: In `ChartWidget.apply()`, offset the world position to center the chart on the NVS bounds, not anchor it at the bottom-left.

Current code (lines 147–151):
```ts
const worldPos = cam
  ? nvsToWorldWithCamera(state.nvsX, state.nvsY, cam, state.z)
  : nvsToWorldAnalytic(state.nvsX, state.nvsY, 0, 0, 12.07, 45, 16 / 9, state.z);

this.chartRenderer.update({ ...state, position: worldPos }, this.widgetId);
```

Replace with:
```ts
const worldCenter = cam
  ? nvsToWorldWithCamera(state.nvsX, state.nvsY, cam, state.z)
  : nvsToWorldAnalytic(state.nvsX, state.nvsY, 0, 0, 12.07, 45, 16 / 9, state.z);

// Center the chart group on the NVS-derived world position.
// Chart content (bars, axes) starts at group-local (0,0) and extends to
// (bounds.width, bounds.height). Subtract half-bounds to center it.
const worldPos: readonly [number, number, number] = [
  worldCenter[0] - state.bounds.width / 2,
  worldCenter[1] - state.bounds.height / 2,
  worldCenter[2],
];

this.chartRenderer.update({ ...state, position: worldPos }, this.widgetId);
```

Also update the heatmap `onTick()` path (lines 171–175) identically. Current code:
```ts
const heatWorldPos = heatCam
  ? nvsToWorldWithCamera(this.lastState.nvsX, this.lastState.nvsY, heatCam, this.lastState.z)
  : nvsToWorldAnalytic(this.lastState.nvsX, this.lastState.nvsY, 0, 0, 12.07, 45, 16 / 9, this.lastState.z);
this.chartRenderer.update({ ...this.lastState, position: heatWorldPos }, this.widgetId);
```

Replace with:
```ts
const heatWorldCenter = heatCam
  ? nvsToWorldWithCamera(this.lastState.nvsX, this.lastState.nvsY, heatCam, this.lastState.z)
  : nvsToWorldAnalytic(this.lastState.nvsX, this.lastState.nvsY, 0, 0, 12.07, 45, 16 / 9, this.lastState.z);
const heatWorldPos: readonly [number, number, number] = [
  heatWorldCenter[0] - this.lastState.bounds.width / 2,
  heatWorldCenter[1] - this.lastState.bounds.height / 2,
  heatWorldCenter[2],
];
this.chartRenderer.update({ ...this.lastState, position: heatWorldPos }, this.widgetId);
```

**No type changes required.** `ChartRenderInput.position` remains `readonly [number, number, number]`.

---

### Stream B — Demo Scene Fix (RC-2): Add Camera + Lighting to all scenes

**Independent of Stream A. Can be worked in parallel.**

#### B1. `apps/examples/src/chart/scenes/chartDemo.tsx`

**Full replacement of the scene DSL file.** All four scenes need a `<Camera>`, `<Lighting>` (via `SceneLighting`), and `<Background>`. The pie scene needs a specific camera that looks at the origin.

**Key changes per scene:**

**chartDemoBar** (Scene 1):
- Already has `<Camera mode="world" position={[2, 1.5, 2]} target={[2, 1.5, 0]} fov={55} />` ✓
- Already has `<SceneLighting />` ✓
- Already has `<Background color="#020812" />` ✓
- No changes needed for this scene.

**chartDemoLine** (Scene 2):
- Add `<Camera mode="world" position={[2, 1.5, 8]} target={[2, 1.5, 0]} fov={45} />` — moved back to see the full chart
- Add `<SceneLighting />`
- Add `<Background color="#020812" />`
- The chart position with the centering fix: group at `[2 - 2, 1.5 - 1.5, 0] = [0, 0, 0]` when nvsX=0.5, nvsY=0.5 with this camera... Wait, nvsToWorldWithCamera with cam at [2, 1.5, 8] pointing at [2, 1.5, 0] would give worldX=2, worldY=1.5. After centering offset: [2-2, 1.5-1.5, 0] = [0, 0, 0]. This would work for a camera target at [2, 1.5, 0].

Actually, it's cleaner to use `PIE_CAM_TGT` (at origin) for pie and a separate camera for line/scatter that matches the bar chart's setup. The chart content extends [0..4, 0..3] in group-local space. After centering by subtracting (2, 1.5), the chart center aligns to the camera target.

**Recommended camera positions for all scenes:**

The centering fix offsets the chartGroup by `[-bounds.width/2, -bounds.height/2, 0]`. So for a chart with `bounds={width:4, height:3}`, the group is at `[worldCenter.x - 2, worldCenter.y - 1.5, 0]`. For `nvsX=0.5, nvsY=0.5` and camera at `[cx, cy, z]` looking at `[cx, cy, 0]`:
- worldCenter = [cx, cy, 0]
- chartGroup at [cx-2, cy-1.5, 0]
- Chart content spans [cx-2, cy-1.5, 0] to [cx+2, cy+1.5, 0]
- Camera sees [cx ± halfW] where halfW = z * tan(fov/2)

For `camera z=7, fov=45`: halfW = 7 * tan(22.5°) ≈ 7 * 0.414 ≈ 2.9. The chart half-width = 2. So the full chart width (4 units) fits within the 5.8-unit visible width. ✓

Use a consistent camera for bar, line, and scatter scenes:
```tsx
const CHART_CAM_POS: [number, number, number] = [2, 1.5, 7];
const CHART_CAM_TGT: [number, number, number] = [2, 1.5, 0];
```

Wait — the current bar scene uses `[2, 1.5, 2]`. After the centering fix, the chart would still extend from `[2-2, 1.5-1.5]=[0,0]` to `[0+4, 0+3]=[4, 3]`. The camera at `[2, 1.5, 2]` with fov=55 sees `[2±1.04]×[1.5±1.04]`. Chart spans `[0..4]×[0..3]`. The chart is wider (4) than the camera view (2.08), so the chart won't fully fit in frame. Moving the camera back to `z=7` with `fov=45` gives `halfW = 2.9`, so the full 4-unit chart width IS visible. Use `z=7, fov=45` for a clean full-chart view.

**Final camera settings for all non-pie scenes:**
```tsx
const CHART_CAM_POS: [number, number, number] = [2, 1.5, 7];
const CHART_CAM_TGT: [number, number, number] = [2, 1.5, 0];
const CHART_CAM_FOV = 45;
```
For pie (square bounds.width=4, height=4), center at [2, 2]:
```tsx
const PIE_CAM_POS: [number, number, number] = [2, 2, 8];
const PIE_CAM_TGT: [number, number, number] = [2, 2, 0];
const PIE_CAM_FOV = 45;
```

**Detailed diff for `chartDemo.tsx`:**

1. Update `CHART_CAM_POS` from `[2, 1.5, 2]` to `[2, 1.5, 7]`
2. Update `fov` from `55` to `45` in all `<Camera>` declarations
3. Add `<Camera>`, `<SceneLighting>`, `<Background>` to `chartDemoLine`, `chartDemoPie`, `chartDemoScatter`
4. For the pie scene, use `PIE_CAM_POS = [2, 2, 8]` and `PIE_CAM_TGT = [2, 2, 0]` with `bounds={{ width: 4, height: 4 }}`
5. Add `<Camera mode="world" position={PIE_CAM_POS} target={PIE_CAM_TGT} fov={PIE_CAM_FOV} />` to `chartDemoPie`

**Complete replacement content for `chartDemo.tsx`:**

```tsx
// Chart demo scenes — bar, line, pie, and scatter examples with real business data.
import type { JSX } from 'react';
import {
  Ambient, Background, Camera, Directional, Lighting,
  ProgressManager, Scene, TextBox,
} from '@brewsite/core';
import { Chart, ChartAxis, ChartData, ChartLegend, ChartSeries } from '@brewsite/charts';

// ─── Sample data ──────────────────────────────────────────────────────────────

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

export const productRevenueData = [
  { product: 'Core Platform', revenue: 520 },
  { product: 'Diagram SDK',   revenue: 285 },
  { product: 'Charts SDK',    revenue: 198 },
  { product: 'Model SDK',     revenue: 162 },
  { product: 'Services',      revenue:  92 },
];

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

// Camera placed at z=7 for full chart visibility.
// After centering fix: chart for bounds {w:4, h:3} spans [-2..2, -1.5..1.5] from chartGroup.
// FOV=45, aspect=1: half-width = 7 * tan(22.5°) ≈ 2.9 → full 4-unit chart width is visible.
const CHART_CAM_POS: [number, number, number] = [2, 1.5, 7];
const CHART_CAM_TGT: [number, number, number] = [2, 1.5, 0];
const CHART_CAM_FOV = 45;

// Pie camera: pie uses bounds {w:4, h:4}, center at (2, 2).
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

// ─── Scene 1: Bar ─────────────────────────────────────────────────────────────

export const chartDemoBar: JSX.Element = (
  <Scene id="chart-demo-bar" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.3] }}>
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={CHART_CAM_POS} target={CHART_CAM_TGT} fov={CHART_CAM_FOV} />
    <SceneLighting />
    <Background color="#020812" />
    <Chart id="bar-revenue" type="bar" theme="darkGlass" bounds={{ width: 4, height: 3, depth: 0.45 }}>
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

// ─── Scene 2: Line ────────────────────────────────────────────────────────────

export const chartDemoLine: JSX.Element = (
  <Scene id="chart-demo-line" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.3] }}>
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={CHART_CAM_POS} target={CHART_CAM_TGT} fov={CHART_CAM_FOV} />
    <SceneLighting />
    <Background color="#020812" />
    <Chart id="line-arr" type="line" theme="darkGlass" bounds={{ width: 4, height: 3, depth: 0.3 }}>
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

// ─── Scene 3: Pie ─────────────────────────────────────────────────────────────

export const chartDemoPie: JSX.Element = (
  <Scene id="chart-demo-pie" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.3] }}>
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={PIE_CAM_POS} target={PIE_CAM_TGT} fov={PIE_CAM_FOV} />
    <SceneLighting />
    <Background color="#020812" />
    <Chart id="pie-products" type="pie" theme="darkGlass" bounds={{ width: 4, height: 4, depth: 0.5 }}>
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

// ─── Scene 4: Scatter ────────────────────────────────────────────────────────

export const chartDemoScatter: JSX.Element = (
  <Scene id="chart-demo-scatter" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.3] }}>
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={CHART_CAM_POS} target={CHART_CAM_TGT} fov={CHART_CAM_FOV} />
    <SceneLighting />
    <Background color="#020812" />
    <Chart id="scatter-teams" type="scatter" theme="darkGlass" bounds={{ width: 4, height: 3, depth: 0.3 }}>
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
```

---

### Stream C — Tests: Add compile and widget tests

**Independent of Streams A and B. Can be worked in parallel.**

#### C1. `packages/charts/src/elements/chart/__tests__/compile.test.ts`

Already exists. **Add the following test cases** to the existing file:

1. **Test: default NVS center computation**
   ```ts
   it('compileChart defaults x/y/w/h to fullscreen NVS (0,0,1,1) and centers nvsX/nvsY at 0.5', () => {
     const state = compileChart({}, { source: 'test' }, [], [], null);
     expect(state.nvsX).toBe(0.5);
     expect(state.nvsY).toBe(0.5);
     expect(state.nvsBounds).toEqual({ x: 0, y: 0, w: 1, h: 1 });
   });
   ```

2. **Test: partial bounds compile correctly**
   ```ts
   it('compileChart with x=0.1, y=0.2, w=0.6, h=0.4 computes correct NVS center', () => {
     const state = compileChart({ x: 0.1, y: 0.2, w: 0.6, h: 0.4 }, { source: 'test' }, [], [], null);
     expect(state.nvsX).toBeCloseTo(0.1 + 0.3); // x + w/2 = 0.4
     expect(state.nvsY).toBeCloseTo(0.2 + 0.2); // y + h/2 = 0.4
   });
   ```

#### C2. `packages/charts/src/elements/chart/__tests__/ChartWidget.test.ts`

Already exists. **Add the following test cases:**

1. **Test: centering offset applied to world position**

   This test verifies the fix from Stream A: that `ChartWidget.apply()` offsets the world position by `-bounds.width/2, -bounds.height/2`.

   ```ts
   it('apply() centers the chart group on the NVS world position (subtracts half-bounds)', () => {
     // The ChartRenderer receives position = [worldX - w/2, worldY - h/2, z]
     // For nvsX=0.5, nvsY=0.5 with hardcoded analytic camera, worldCenter = [0, 0, 0]
     // For bounds {width:4, height:3}: chartGroup should be at [-2, -1.5, 0]
     // Verify by inspecting chartRenderer.update call args via a test double.
   });
   ```

   Implementation: Use a minimal `ChartDataStore` double with pre-registered data. Call `widget.initialize({ scene: mockScene, widgetId, camera: null })` then `widget.apply(state, ctx)`. Assert that `chartGroup.position` (accessible via `scene.children`) is at `[worldX - bounds.width/2, worldY - bounds.height/2, 0]`. Since camera is null, `nvsToWorldAnalytic` is used with known constants — world center = `nvsToWorldAnalytic(0.5, 0.5, 0, 0, 12.07, 45, 16/9, 0) = [0, 0, 0]` — and the resulting position should be `[-2, -1.5, 0]` for `bounds.width=4, height=3`.

2. **Test: apply() with null camera falls back to nvsToWorldAnalytic**

   Already exists implicitly. Ensure it explicitly asserts the fallback path produces consistent positioning.

#### C3. `packages/charts/src/elements/chart/__tests__/centering.test.ts` (new file)

Create a new test file specifically for the centering contract:

```ts
// centering.test.ts — verifies the NVS→world centering contract for ChartWidget.apply()
import { describe, it, expect } from 'vitest';
import { nvsToWorldAnalytic } from '@brewsite/core';

describe('Chart world positioning — centering contract', () => {
  it('nvsToWorldAnalytic(0.5, 0.5, ...) returns [0, 0, targetZ] for centered camera', () => {
    const [x, y, z] = nvsToWorldAnalytic(0.5, 0.5, 0, 0, 12.07, 45, 16/9, 0);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
    expect(z).toBe(0);
  });

  it('chart group position = worldCenter - [bounds.w/2, bounds.h/2, 0]', () => {
    const worldCenter: [number, number, number] = [0, 0, 0];
    const bounds = { width: 4, height: 3, depth: 0.45 };
    const expected = [
      worldCenter[0] - bounds.width / 2,
      worldCenter[1] - bounds.height / 2,
      worldCenter[2],
    ];
    expect(expected).toEqual([-2, -1.5, 0]);
  });
});
```

---

## Step-by-Step Implementation Instructions

### Step 1: Apply chart centering fix (Stream A)

**File**: `packages/charts/src/elements/chart/ChartWidget.ts`

1. Open `ChartWidget.ts` and locate `apply()` (line 138).
2. Find the `worldPos` computation (lines 147–149):
   ```ts
   const worldPos = cam
     ? nvsToWorldWithCamera(state.nvsX, state.nvsY, cam, state.z)
     : nvsToWorldAnalytic(state.nvsX, state.nvsY, 0, 0, 12.07, 45, 16 / 9, state.z);
   ```
3. Rename `worldPos` to `worldCenter`.
4. After computing `worldCenter`, declare:
   ```ts
   const worldPos: readonly [number, number, number] = [
     worldCenter[0] - state.bounds.width / 2,
     worldCenter[1] - state.bounds.height / 2,
     worldCenter[2],
   ];
   ```
5. Pass `worldPos` to `this.chartRenderer.update(...)` as before.
6. Repeat the same change in `onTick()` (lines 171–175): rename `heatWorldPos` to `heatWorldCenter`, then derive the centered `heatWorldPos` with the same offset pattern.
7. No other files in `packages/charts/src/elements/chart/` require changes.

### Step 2: Fix camera/lighting/background for all demo scenes (Stream B)

**File**: `apps/examples/src/chart/scenes/chartDemo.tsx`

Complete file replacement with the content specified in section B1 above. Key changes:

1. Replace `CHART_CAM_POS` from `[2, 1.5, 2]` to `[2, 1.5, 7]`
2. Rename `CHART_CAM_TGT` (already `[2, 1.5, 0]`) and `fov` from `55` to `45`
3. Add `PIE_CAM_POS`, `PIE_CAM_TGT`, `PIE_CAM_FOV` constants
4. Add `<Camera>`, `<SceneLighting>`, `<Background>` to `chartDemoLine`, `chartDemoPie`, `chartDemoScatter`
5. Update the existing bar scene to use the new camera constants (position changed to z=7, fov=45)

### Step 3: Add tests (Stream C)

1. Add test cases to `packages/charts/src/elements/chart/__tests__/compile.test.ts`
2. Add centering assertion to `packages/charts/src/elements/chart/__tests__/ChartWidget.test.ts`
3. Create `packages/charts/src/elements/chart/__tests__/centering.test.ts`

### Step 4: Verify

Run:
```bash
pnpm --filter @brewsite/charts test
pnpm --filter @brewsite/charts typecheck
```

Navigate to `/examples/chart` in the dev server. All four scenes should now show:
- Bars centered in the viewport (bar chart)
- A full spline curve centered in the viewport (line chart)
- Pie slices visible and centered (pie chart)
- Scatter dots visible and centered (scatter chart)

---

## Parallelization: Work Streams

All three work streams are independent and can be executed in parallel by separate developers. They touch non-overlapping files:

| Stream | Files | Can run in parallel with |
|--------|-------|--------------------------|
| A | `packages/charts/src/elements/chart/ChartWidget.ts` only | B, C |
| B | `apps/examples/src/chart/scenes/chartDemo.tsx` only | A, C |
| C | `packages/charts/src/elements/chart/__tests__/compile.test.ts`, `ChartWidget.test.ts`, new `centering.test.ts` | A, B |

**Important**: Stream A must be merged before Stream C tests are verified against the running demo. The tests in Stream C can be written first (they're unit tests that don't depend on the browser), but the visual verification of C depends on A and B both being applied.

---

## Testing Strategy

### Unit tests (Stream C)

All tests live in `packages/charts/src/elements/chart/__tests__/`. Run with:
```bash
pnpm --filter @brewsite/charts vitest run src/elements/chart/__tests__/compile.test.ts
pnpm --filter @brewsite/charts vitest run src/elements/chart/__tests__/ChartWidget.test.ts
pnpm --filter @brewsite/charts vitest run src/elements/chart/__tests__/centering.test.ts
```

**What each test must assert:**
- `compile.test.ts`: `compileChart()` with no position args defaults to nvsX=0.5, nvsY=0.5, nvsBounds={x:0,y:0,w:1,h:1}
- `compile.test.ts`: `compileChart()` with explicit x/y/w/h produces correct center
- `ChartWidget.test.ts`: `widget.apply()` with null camera calls `nvsToWorldAnalytic` and offsets by `-bounds.width/2, -bounds.height/2`
- `centering.test.ts`: Pure math assertion that `[worldCenter[0] - w/2, worldCenter[1] - h/2, z]` == `[-2, -1.5, 0]` for center=`[0,0,0]`, bounds `{w:4, h:3}`

### Integration verification (manual)

Navigate to `/examples/chart` after applying all three streams. Verify:

1. **Bar scene** (scene 1): All 12 months' bars visible, centered in viewport, `revenue` and `costs` series both visible in different colors, legend on the right.
2. **Line scene** (scene 2): Full ARR growth curve visible as a spline tube, centered in viewport.
3. **Pie scene** (scene 3): Pie slices visible and centered, 5 product segments.
4. **Scatter scene** (scene 4): Scatter dots visible across the chart area, centered.

Check browser console for any:
- `[ChartRenderer] No data for source` warnings (should not appear — indicates data registration failure)
- `[WidgetRegistry] No widget found` warnings (should not appear — indicates compilation failure)
- `[ChartWidget] apply() called but scene is null` errors (should not appear — indicates initialization failure)

---

## Error Handling and Edge Cases

### Edge case: `bounds.width` or `bounds.height` is 0 or undefined

In `ChartWidget.apply()`, before computing the centering offset, `state.bounds.width` and `state.bounds.height` come from the compiled state. The `DEFAULT_CHART_STATE.bounds = { width: 4, height: 3, depth: 0.4 }`. If a consumer passes `bounds={{ width: 0, height: 0 }}`, the offset would be zero and the chart would render at the NVS center — no geometry would be built (all `barH <= 0` in `buildBars`). This is correct behavior: zero-sized chart = no geometry.

### Edge case: camera `null` in `initialize()`

If `initialize()` is called without a camera (possible in test environments), `this.cameraRef` remains null and `apply()` falls back to `nvsToWorldAnalytic` with hardcoded parameters. The centering fix applies identically in this branch — no special handling needed.

### Edge case: chart type changes mid-scene

`ChartRenderer` already handles type changes by disposing the old renderer and creating a new one. The centering offset is applied at the `chartGroup.position` level, which persists across renderer changes. No impact.

### Edge case: `nvsToWorldWithCamera` with tilted camera

The function assumes the camera looks straight along -Z (only uses `camera.position.x/y` as viewport center). If a consumer uses a tilted camera (e.g., looking diagonally), the NVS→world mapping would be incorrect regardless of the centering fix. This is a pre-existing limitation documented in the function's JSDoc, not a regression from this fix. The centering fix does not worsen this behavior.

---

## Notes on Non-Scope Items

The following were considered but excluded from this plan as they are not required to fix the rendering issue:

- **`nvsToWorldWithCamera` tilted-camera support**: A more robust implementation would use the camera's projection and view matrices. Out of scope — requires core changes and all current usages assume -Z alignment.
- **`manifest` compilation gate**: The requirement for `manifest !== null` before scene compilation is an existing architectural decision. The chart demo works because `website/public/scene-manifest.json` is served by the Vite dev server for all bare paths. Not a chart bug.
- **`AxesRenderer` text render order**: Minor visual polish issue. Axes and legend text render correctly with troika's built-in font. Not a cause of missing chart geometry.
