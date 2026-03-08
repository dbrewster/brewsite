import type {JSX} from 'react';
import {
  Action,
  Background,
  Camera,
  InputController,
  KeyMap,
  PointerMap,
  ProgressManager,
  Scene,
  TextBox,
  WheelMap,
} from '@brewsite/core';
import {Diagram, DiagramCanvas, DiagramEdge, DiagramNode, FlowLayout,} from '@brewsite/diagram';
import {brewflowTheme} from '../../brewflow-sidecar/theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneInjector: JSX.Element = (
  <Scene key="bfm-injector" id="bfm-injector">
    <ProgressManager scrollUnits={2800} fn={DWELL_FN} />
    <Camera mode="world" position={[0, 5, 24]} target={[0, 0, 0]} fov={52} />
    <Background color="#080b14" />

    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bfm-inject-canvas">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bfm-inject-canvas">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bfm-inject-canvas">
        <KeyMap keyName="r" />
      </Action>
    </InputController>

    <DiagramCanvas id="bfm-inject-canvas" x={0} y={0} w={1} h={0.58} tilt={config.diagramRotationX} scale={config.diagramScale} theme={brewflowTheme}>
      <Diagram id="inject-diagram">
        <FlowLayout direction="top-down" gap={2} />

        {/* Core + serving modes */}
        <DiagramNode id="inj-core" label="InjectorCortex" sublabel="bounded · ordered · reproducible" size={[7, 2.8]} color="#141830" glow={{ intensity: 0.15 }} />
        <DiagramNode id="mode-initial" label="Mode 1: Initial Pack" sublabel="agent spawn · pre-task hook · scope + intent + budget" size={[7, 2.4]} color="#101828" />
        <DiagramNode id="mode-midsession" label="Mode 2: Mid-Session" sublabel="mcp__brewflow__recall · fresh bounded packet" size={[7, 2.4]} color="#101828" />
        <DiagramNode id="mode-schematic" label="Memory Schematic" sublabel="workstream restart packet · proven state + constraints + next steps" size={[7, 2.4]} color="#141830" glow={{ intensity: 0.1 }} />

        <DiagramEdge from="inj-core" to="mode-initial" arrowEnd="open" color="#5070b0" />
        <DiagramEdge from="inj-core" to="mode-midsession" arrowEnd="open" color="#5070b0" />
        <DiagramEdge from="inj-core" to="mode-schematic" arrowEnd="open" color="#6080c0" />

        {/* Injection order column (right side) */}
        <DiagramNode id="ord-1" label="1. Constraints" sublabel="must not do" size={[5.5, 2.0]} color="#1a1020" />
        <DiagramNode id="ord-2" label="2. Disambiguation" sublabel="interpret ambiguity" size={[5.5, 2.0]} color="#101828" />
        <DiagramNode id="ord-3" label="3. Procedures" sublabel="how to do it" size={[5.5, 2.0]} color="#101828" />
        <DiagramNode id="ord-4" label="4. Checklists" sublabel="verify before ship" size={[5.5, 2.0]} color="#101828" />
        <DiagramNode id="ord-5" label="5. Pitfalls" sublabel="known failures" size={[5.5, 2.0]} color="#101828" />
        <DiagramNode id="ord-6" label="6. Concepts" sublabel="vocabulary" size={[5.5, 2.0]} color="#101828" />

        <DiagramEdge from="ord-1" to="ord-2" flow="forward" color="#4060a0" />
        <DiagramEdge from="ord-2" to="ord-3" flow="forward" color="#4060a0" />
        <DiagramEdge from="ord-3" to="ord-4" flow="forward" color="#4060a0" />
        <DiagramEdge from="ord-4" to="ord-5" flow="forward" color="#4060a0" />
        <DiagramEdge from="ord-5" to="ord-6" flow="forward" color="#4060a0" />
      </Diagram>
    </DiagramCanvas>

    <TextBox id="bfm-inject-prose" x={0} y={0.58} w={1} h={0.42}>
      <div style={{
        padding: '40px 64px 48px',
        background: 'rgba(8, 11, 20, 0.88)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        height: '100%',
        overflowY: 'auto',
        pointerEvents: 'auto',
        boxSizing: 'border-box',
      }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '13px',
          letterSpacing: '0.25em',
          textTransform: 'uppercase' as const,
          color: 'rgba(100, 140, 220, 0.7)',
          marginBottom: 16,
        }}>
          INJECTOR CORTEX — WHAT YOU GET
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          <div>
            <h3 style={{ fontSize: '18px', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
              Bounded context packs
            </h3>
            <p style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 16px' }}>
              InjectorCortex assembles memory packs that fit within a declared token budget.
              The pack is ordered, deterministic, and reproducible — given the same Neocortex
              state and the same query, the same pack is produced. This makes context injection
              auditable and debuggable.
            </p>
            <h3 style={{ fontSize: '18px', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
              Memory schematic for restart
            </h3>
            <p style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: 0 }}>
              For workstream restart, InjectorCortex produces a "memory schematic" — a
              structured packet summarizing proven state, active constraints, current next
              steps, and known pitfalls. A new agent starting a resumed workstream receives
              this schematic and can continue where the previous agent left off without
              re-reading the full episode log.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: '18px', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
              Injection order rationale
            </h3>
            <p style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 12px' }}>
              The canonical injection order reflects cognitive priority for safe task execution.
              Constraints come first because an agent that violates a hard rule before reading
              its procedures is already compromised. Disambiguation comes second because
              misinterpreted terms corrupt everything downstream. Procedures and checklists
              follow as operational knowledge. Pitfalls and concepts close out the pack as
              reference material.
            </p>
            <p style={{ fontSize: '15px', color: 'rgba(160, 180, 220, 0.65)', lineHeight: 1.7, margin: 0, fontStyle: 'italic' }}>
              Token budget is enforced by truncating at the end of the ordered list — so
              concepts and pitfalls are dropped before constraints are ever cut.
            </p>
          </div>
        </div>
      </div>
    </TextBox>
  </Scene>
);
