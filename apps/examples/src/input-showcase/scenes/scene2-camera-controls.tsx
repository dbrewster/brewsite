// Scene 2: Camera Controls — every camera.orbit / camera.zoom / camera.reset binding.
// Demonstrates: PointerMap(drag left/right), WheelMap, PinchMap, KeyMap, modifier keys.
import type { JSX } from 'react';
import {
  Action,
  Ambient,
  Camera,
  Directional,
  Floor,
  formatModifier,
  InputController,
  InputHud,
  KeyMap,
  Lighting,
  PinchMap,
  PointerMap,
  ProgressManager,
  Scene,
  TextBox,
  View,
  WheelMap,
  type InputHudState,
} from '@brewsite/core';
import {
  BarChart,
  ChartAxis,
  ChartData,
  ChartSeries,
} from '@brewsite/charts';
import {Diagram, DiagramEdge, DiagramGroup, DiagramNode, FlowLayout, GridLayout} from "@brewsite/diagram";
import {config} from "../../settings";

const CAM_POS: [number, number, number] = [0, 1.5, 7];
const CAM_TGT: [number, number, number] = [0, 0, 0];

const cameraBindingData = [
  { action: 'Orbit', maps: 3 },
  { action: 'Dolly', maps: 4 },
  { action: 'Reset', maps: 2 },
];

// Color key for kbd elements in the reference card
const C_CAMERA = '#5090e0';
const C_MODIFIER = '#c050e0';
const C_RESET = '#e07050';
const C_SCENE = '#c06040';

interface KbdProps {
  children: string;
  color?: string;
}
function Kbd({ children, color = C_CAMERA }: KbdProps): JSX.Element {
  return (
    <kbd
      style={{
        background: color + '22',
        border: `1px solid ${color}55`,
        borderRadius: 5,
        padding: '2px 8px',
        fontFamily: 'monospace',
        fontSize: 13,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </kbd>
  );
}

interface BindingRowProps {
  label: string;
  keys: Array<{ text: string; color?: string }>;
  desc: string;
}
function BindingRow({ label, keys, desc }: BindingRowProps): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 9 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 2 }}>
        <span style={{ fontSize: 11, color: 'rgba(160,200,255,0.6)', minWidth: 50 }}>{label}</span>
        {keys.map((k, i) => (
          <Kbd key={i} color={k.color}>{k.text}</Kbd>
        ))}
      </div>
      <span style={{ fontSize: 10, color: 'rgba(140,180,240,0.55)', paddingLeft: 54 }}>{desc}</span>
    </div>
  );
}

/** Minimal InputHud state — forward-compatible stub wiring. */
const inputHudState: InputHudState = { hints: [], platform: 'unknown' };

export const CameraControlsScene = (): JSX.Element => {
  return (
    <Scene id="input-camera">
      <ProgressManager scrollUnits={800} />
      <Camera mode="world" position={CAM_POS} target={CAM_TGT} fov={48} />
      <Lighting intensityScale={1}>
        <Ambient intensity={0.5} color="#d7e8ff" />
        <Directional intensity={1.3} color="#b0ccff" position={[-5, 10, 8]} />
        <Directional intensity={0.7} color="#ffd8b0" position={[8, 6, 6]} />
      </Lighting>
      <Floor variant="grid" negativeZExtent={18} />

      <InputController scope="canvas">
        {/* Orbit — primary (left drag) */}
        <Action id="orbit" type="camera.orbit">
          <PointerMap event="drag" button="left" axis="xy" />
        </Action>
        {/* Orbit — modifier speed variants (⌘/Ctrl+drag) */}
        <Action id="orbit-mod" type="camera.orbit" speed={0.8}>
          <PointerMap event="drag" button="right" axis="xy" />
          <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
        </Action>
        {/* Zoom — wheel */}
        <Action id="dolly" type="camera.zoom">
          <WheelMap axis="y" />
          <PinchMap direction="both" threshold={1} />
        </Action>
        {/* Zoom — precision (ctrl+wheel) */}
        <Action id="dolly-precision" type="camera.zoom" speed={0.25}>
          <WheelMap axis="y" modifiers={['ctrl']} />
        </Action>
        {/* Reset */}
        <Action id="reset" type="camera.reset">
          <KeyMap keyName="r" />
          <PointerMap event="click" modifiers={['meta']} />
        </Action>
        {/* Scene navigation */}
        <Action id="scene-next" type="scene.next">
          <KeyMap keyName="ArrowDown" />
        </Action>
        <Action id="scene-prev" type="scene.prev">
          <KeyMap keyName="ArrowUp" />
        </Action>
      </InputController>

      {/* Chart view */}
      <View id="cam-diagram-view" x={0.05} y={0.50} w={0.58} h={0.40}>
        <Diagram id="cf-overview" x={0} y={0} w={1} h={1} scale={1.4}>
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
      <View id="cam-chart-view" x={0.05} y={0.09} w={0.58} h={0.39}>
        <BarChart
          id="is-camera-binding-chart"
          data={cameraBindingData}
          x={0} y={0} w={1} h={1}
          depth={0.3}
        >
          <ChartData keyField="action" />
          <ChartAxis axis="x" field="action" label="Action Type" />
          <ChartAxis axis="y" field="maps" label="Input Maps Bound" />
          <ChartSeries field="maps" label="Bindings" />
        </BarChart>
      </View>

      {/* Controls reference card */}
      <TextBox id="cam-ref" x={0.66} y={0.08} w={0.32} h={0.86} layer={3}>
        <div
          style={{
            height: '100%',
            overflowY: 'auto',
            padding: '14px 16px',
            background: 'rgba(4, 12, 28, 0.88)',
            backdropFilter: 'blur(14px)',
            borderRadius: 10,
            border: '1px solid rgba(70, 130, 220, 0.3)',
            boxSizing: 'border-box',
          }}
        >
          <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#c8deff', fontWeight: 600 }}>
            Camera Controls
          </h3>

          <div style={{ fontSize: 10, color: 'rgba(120,160,220,0.5)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
            Orbit
          </div>
          <BindingRow
            label="orbit"
            keys={[{ text: 'Left Drag', color: C_CAMERA }]}
            desc="Primary orbit (full speed)"
          />
          <BindingRow
            label="orbit ×0.8"
            keys={[{ text: 'Right Drag', color: C_CAMERA }, { text: formatModifier('meta'), color: C_MODIFIER }, { text: '+ Left Drag', color: C_CAMERA }]}
            desc={`Slower orbit — right button or ${formatModifier('meta')}+drag`}
          />

          <div style={{ fontSize: 10, color: 'rgba(120,160,220,0.5)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '10px 0 8px' }}>
            Dolly
          </div>
          <BindingRow
            label="dolly"
            keys={[{ text: 'Scroll', color: C_CAMERA }]}
            desc="Wheel scroll — full speed"
          />
          <BindingRow
            label="dolly"
            keys={[{ text: 'Pinch', color: C_CAMERA }]}
            desc="Pinch in/out — full speed"
          />
          <BindingRow
            label="zoom ×0.25"
            keys={[{ text: formatModifier('ctrl'), color: C_MODIFIER }, { text: '+ Scroll', color: C_CAMERA }]}
            desc="Precision zoom — 4× slower"
          />

          <div style={{ fontSize: 10, color: 'rgba(120,160,220,0.5)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '10px 0 8px' }}>
            Reset
          </div>
          <BindingRow
            label="reset"
            keys={[{ text: 'R', color: C_RESET }]}
            desc="Keyboard reset"
          />
          <BindingRow
            label="reset"
            keys={[{ text: formatModifier('meta'), color: C_MODIFIER }, { text: '+ Click', color: C_RESET }]}
            desc={`${formatModifier('meta')}+click reset`}
          />

          <div style={{ fontSize: 10, color: 'rgba(120,160,220,0.5)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '10px 0 8px' }}>
            Scene Nav
          </div>
          <BindingRow
            label="next"
            keys={[{ text: '↓', color: C_SCENE }]}
            desc="Next scene"
          />
          <BindingRow
            label="prev"
            keys={[{ text: '↑', color: C_SCENE }]}
            desc="Previous scene"
          />

          <div
            style={{
              marginTop: 12,
              padding: '8px 10px',
              background: 'rgba(80, 144, 224, 0.1)',
              borderRadius: 6,
              border: '1px solid rgba(80, 144, 224, 0.2)',
              fontSize: 10,
              color: 'rgba(160, 200, 255, 0.65)',
              lineHeight: 1.5,
            }}
          >
            scope="canvas" — input fires only when cursor is over the canvas area.
          </div>
          {/* InputHud stub — forward-compatible wiring for future binding overlay */}
          <InputHud state={inputHudState} />
        </div>
      </TextBox>
    </Scene>
  );
};
