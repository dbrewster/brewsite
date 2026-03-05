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
import {Diagram, DiagramCanvas, DiagramNode, GridLayout,} from '@brewsite/diagram';
import {brewflowTheme} from '../../brewflow-sidecar/theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneDim1Audit: JSX.Element = (
  <Scene key="bfc-dim1-audit" id="bfc-dim1-audit">
    <ProgressManager scrollUnits={2800} fn={DWELL_FN} />

    <Camera mode="world" position={[0, 5, 28]} target={[0, 0, 0]} fov={52} />
    <Background color="#080b14" />

    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bfc-audit-canvas">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bfc-audit-canvas">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bfc-audit-canvas">
        <KeyMap keyName="r" />
      </Action>
    </InputController>

    <DiagramCanvas id="bfc-audit-canvas" position={[0, config.diagramTop, 0]} rotation={[config.diagramRotationX, 0, 0]} scale={config.diagramScale} theme={brewflowTheme}>
      {/* Left side — claude-flow */}
      <Diagram id="audit-cf" pivot="center">
        <GridLayout columns={2} spacing={[3, 2]} />

        <DiagramNode id="cf-events-node" label="events table" sublabel="generic rows · timestamp · label · no global order · no lineage" size={[7, 2.8]} color="#1a1520" />
        <DiagramNode id="cf-audit-q1" label="What was logged?" sublabel="✓ answerable" size={[6, 2.2]} color="#102015" />
        <DiagramNode id="cf-audit-q2" label="Why did this happen?" sublabel="✗ not answerable without manual joins" size={[6, 2.2]} color="#201010" />

        {/* Right side — BrewFlow */}
        <DiagramNode id="bf-episodic-node" label="EpisodicStore" sublabel="typed records · globalEventSeq · lineage closure at query time" size={[7, 2.8]} color="#141830" glow={{ intensity: 0.15 }} />
        <DiagramNode id="bf-audit-q1" label="What happened?" sublabel="✓ typed, ordered, reproducible" size={[6, 2.2]} color="#102015" />
        <DiagramNode id="bf-audit-q2" label="Why did this happen?" sublabel="✓ lineage closure: session→plan→thread→turn" size={[6, 2.2]} color="#0f2015" />
      </Diagram>
    </DiagramCanvas>

    <TextBox id="dim1-prose" x={0} y={0.56} w={1} h={0.44}>
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
          DIMENSION 1: THE AUDIT TRAIL
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          <div>
            <h3 style={{ fontSize: 26, color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
              claude-flow: events table
            </h3>
            <p style={{ fontSize: 18, color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 16px' }}>
              The events table records what happened — agent actions, task transitions, system
              events. Each row has a timestamp, a label, and an optional payload. For answering
              "what was logged?" it works. For answering "why did agent B make this decision?"
              you need manual SQL joins across sessions, tasks, and shared_state, with no
              guarantee the causal chain is reconstructable.
            </p>
            <p style={{ fontSize: 15, color: 'rgba(160, 180, 220, 0.6)', lineHeight: 1.7, fontStyle: 'italic', margin: 0 }}>
              There is no global event ordering and no lineage tracking across the 12 tables.
              Post-incident investigation is limited to what you can manually correlate.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: 26, color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
              BrewFlow: EpisodicStore globalEventSeq + lineage
            </h3>
            <p style={{ fontSize: 18, color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 16px' }}>
              Every event written to EpisodicStore receives a monotonically increasing
              globalEventSeq. Events carry typed schemas and explicit lineage references:
              session, plan, thread, and turn. At query time, lineage closure reconstructs
              the complete causal chain for any event — session to plan to thread to the
              specific turn that caused the outcome.
            </p>
            <p style={{ fontSize: 18, color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: 0 }}>
              The practical difference: a post-incident investigation that takes hours with
              claude-flow (or is simply impossible) takes minutes with BrewFlow — you query
              the event, follow the lineage closure, and read the full context.
            </p>
          </div>
        </div>
      </div>
    </TextBox>
  </Scene>
);
