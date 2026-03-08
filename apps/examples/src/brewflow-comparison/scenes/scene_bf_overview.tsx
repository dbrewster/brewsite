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
import {Diagram, DiagramCanvas, DiagramEdge, DiagramEnter, DiagramNode, FlowLayout,} from '@brewsite/diagram';
import {brewflowTheme} from '../../brewflow-sidecar/theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneBfOverview: JSX.Element = (
  <Scene key="bfc-bf-overview" id="bfc-bf-overview">
    <ProgressManager scrollUnits={2600} fn={DWELL_FN} />

    <Background color="#080b14" />

    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bfc-bf-canvas">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bfc-bf-canvas">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bfc-bf-canvas">
        <KeyMap keyName="r" />
      </Action>
    </InputController>

    <DiagramCanvas id="bfc-bf-canvas" position={[0, config.diagramTop+1, 0]} rotation={[config.diagramRotationX, 0, 0]} scale={config.diagramScale} theme={brewflowTheme}>
      <Diagram id="bf-overview">
        <FlowLayout direction="top-down" gap={2} />
        <DiagramEnter fade />

        <DiagramNode id="bf-episodic" label="EpisodicStore" sublabel="append-only JSONL · globalEventSeq · lineage refs · single-writer" size={[10, 2.8]} color="#141830" glow={{ intensity: 0.1 }} />
        <DiagramNode id="bf-somno" label="Somniocortex" sublabel="7-stage consolidation · LLM proposes · deterministic validators accept" size={[10, 2.8]} color="#141830" glow={{ intensity: 0.12 }} />
        <DiagramNode id="bf-neo" label="Neocortex" sublabel="typed versioned cards · procedure · constraint · pitfall · provenance-backed" size={[10, 2.8]} color="#141830" glow={{ intensity: 0.14 }} />
        <DiagramNode id="bf-inject" label="InjectorCortex" sublabel="token-budget bounded · ordered · reproducible context packs · memory schematic" size={[10, 2.8]} color="#141830" glow={{ intensity: 0.12 }} />
        <DiagramNode id="bf-guard" label="Sensitive Data Guard" sublabel="every write boundary · allow_store · store_redacted · store_sealed · no_store" size={[10, 2.4]} color="#1a0f20" glow={{ intensity: 0.08 }} />

        <DiagramEdge from="bf-episodic" to="bf-somno" flow="forward" color="#5070b0" />
        <DiagramEdge from="bf-somno" to="bf-neo" flow="forward" color="#5070b0" />
        <DiagramEdge from="bf-neo" to="bf-inject" style="dashed" label="retrieval" color="#5070b0" />
        <DiagramEdge from="bf-inject" to="bf-guard" flow="forward" color="#4a3570" />
      </Diagram>
    </DiagramCanvas>

    <TextBox id="bf-overview-prose" x={0} y={0.56} w={1} h={0.44}>
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
          WHAT BREWFLOW'S MEMORY ACTUALLY IS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          <div>
            <h3 style={{ fontSize: 26, color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
              A four-layer CLS-inspired pipeline
            </h3>
            <p style={{ fontSize: 18, color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 16px' }}>
              BrewFlow models memory after Complementary Learning Systems theory: fast episodic
              capture (EpisodicStore), offline consolidation (Somniocortex), structured long-term
              storage (Neocortex), and bounded context injection (InjectorCortex). The pipeline
              separates observation from knowledge — raw events are never directly used as
              knowledge without passing through consolidation validation.
            </p>
            <h3 style={{ fontSize: 26, color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
              Sensitive Data Guard
            </h3>
            <p style={{ fontSize: 18, color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: 0 }}>
              Every write boundary — ingestion, consolidation, promotion, context assembly —
              runs through a classification pipeline. Data is routed to allow_store,
              store_redacted, store_sealed, or no_store based on sensitivity. CensorCortex
              enforces lane-scoped access at read time.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: 26, color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
              The honest complexity acknowledgment
            </h3>
            <p style={{ fontSize: 18, color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 16px' }}>
              BrewFlow is meaningfully more complex than claude-flow's SQLite model. The
              7-stage Somniocortex pipeline, typed Neocortex card lifecycle, and InjectorCortex
              retrieval pipeline require significantly more infrastructure. For short-lived
              tasks and simple swarm coordination, this complexity does not pay off.
            </p>
            <p style={{ fontSize: 15, color: 'rgba(160, 180, 220, 0.65)', lineHeight: 1.7, fontStyle: 'italic', margin: 0 }}>
              BrewFlow's value proposition is compounding: each session adds validated
              knowledge that improves the next session. The investment only pays off
              across many sessions on similar problem domains.
            </p>
          </div>
        </div>
      </div>
    </TextBox>
  </Scene>
);
