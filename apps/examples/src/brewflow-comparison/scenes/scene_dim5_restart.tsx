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
import {Diagram, DiagramCanvas, DiagramEdge, DiagramNode, GridLayout,} from '@brewsite/diagram';
import {brewflowTheme} from '../../brewflow-sidecar/theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneDim5Restart: JSX.Element = (
  <Scene key="bfc-dim5-restart" id="bfc-dim5-restart">
    <ProgressManager scrollUnits={2800} fn={DWELL_FN} />

    <Background color="#080b14" />

    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bfc-restart-canvas">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bfc-restart-canvas">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bfc-restart-canvas">
        <KeyMap keyName="r" />
      </Action>
    </InputController>

    <DiagramCanvas id="bfc-restart-canvas" position={[0, config.diagramTop, 0]} rotation={[config.diagramRotationX, 0, 0]} scale={config.diagramScale} theme={brewflowTheme}>
      <Diagram id="restart-diagram">
        <GridLayout columns={2} spacing={[3, 2]} />

        {/* Left — claude-flow process recovery */}
        <DiagramNode id="rs-cf-crash" label="Process crash" size={[6, 2.4]} color="#2a1010" />
        <DiagramNode id="rs-cf-snap" label="workflow_state snapshot" sublabel="where was execution?" size={[6, 2.4]} color="#1a1520" />
        <DiagramNode id="rs-cf-resume" label="Resumed agent" sublabel="inherits context drift from prior session" size={[6, 2.4]} color="#1a1520" />

        <DiagramEdge from="rs-cf-crash" to="rs-cf-snap" flow="forward" color="#805050" />
        <DiagramEdge from="rs-cf-snap" to="rs-cf-resume" flow="forward" color="#805050" />

        {/* Right — BrewFlow checkpoint-restart */}
        <DiagramNode id="rs-bf-fail" label="Workstream interrupted" size={[6, 2.4]} color="#2a1010" />
        <DiagramNode id="rs-bf-episodic" label="EpisodicStore" sublabel="what was attempted · what changed · what failed" size={[6, 2.2]} color="#141830" />
        <DiagramNode id="rs-bf-neo" label="Neocortex" sublabel="relevant constraints + procedures" size={[6, 2.2]} color="#141830" glow={{ intensity: 0.12 }} />
        <DiagramNode id="rs-bf-schema" label="Memory Schematic" sublabel="bounded · proof status · lane boundaries · artifacts" size={[6, 2.4]} color="#141e35" glow={{ intensity: 0.15 }} />
        <DiagramNode id="rs-bf-fresh" label="Fresh agent" sublabel="clean context · no drift · full epistemic context" size={[6, 2.4]} color="#0f2030" glow={{ intensity: 0.1 }} />

        <DiagramEdge from="rs-bf-fail" to="rs-bf-episodic" flow="forward" color="#5070b0" />
        <DiagramEdge from="rs-bf-fail" to="rs-bf-neo" style="dashed" color="#5070b0" />
        <DiagramEdge from="rs-bf-episodic" to="rs-bf-schema" flow="forward" color="#5070b0" />
        <DiagramEdge from="rs-bf-neo" to="rs-bf-schema" flow="forward" color="#5070b0" />
        <DiagramEdge from="rs-bf-schema" to="rs-bf-fresh" flow="forward" color="#5070b0" />
      </Diagram>
    </DiagramCanvas>

    <TextBox id="dim5-prose" x={0} y={0.56} w={1} h={0.44}>
      <div style={{
        padding: '36px 60px 44px',
        background: 'rgba(8, 11, 20, 0.88)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        height: '100%',
        overflowY: 'auto',
        boxSizing: 'border-box',
      }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 13,
          letterSpacing: '0.25em',
          textTransform: 'uppercase' as const,
          color: 'rgba(100, 140, 220, 0.7)',
          marginBottom: 16,
        }}>
          DIMENSION 5: CHECKPOINT AND RESTART
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          <div>
            <h3 style={{ fontSize: 26, color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
              claude-flow: process recovery (where?)
            </h3>
            <p style={{ fontSize: 18, color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 16px' }}>
              The workflow_state table stores execution checkpoints — enough to resume a
              crashed process from approximately where it left off. This answers "where was
              I?" effectively. The resumed agent re-enters its task with the accumulated
              session context, which may include drift from earlier mistakes or outdated
              assumptions that were never corrected.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: 26, color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
              BrewFlow: epistemic recovery (what was known?)
            </h3>
            <p style={{ fontSize: 18, color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 16px' }}>
              BrewFlow's checkpoint-restart provides a fresh agent with full epistemic context.
              The Memory Schematic captures what was attempted, what succeeded, what failed,
              what constraints were proven, and what artifacts were produced. A fresh agent
              — with no accumulated context drift — receives this schematic and can continue
              effectively without inheriting the prior session's mistakes or stale assumptions.
            </p>
            <p style={{ fontSize: 15, color: 'rgba(160, 180, 220, 0.65)', lineHeight: 1.7, fontStyle: 'italic', margin: 0 }}>
              The key insight: for long workstreams, a fresh agent with good epistemic context
              often outperforms a resumed agent with accumulated drift. BrewFlow makes the
              fresh-agent restart viable; claude-flow makes the resumed-agent path easier.
            </p>
          </div>
        </div>
      </div>
    </TextBox>
  </Scene>
);
