import type {JSX} from 'react';
import {
    Action,
    Ambient,
    Background,
    Camera,
    Directional,
    InputController,
    KeyMap,
    Lighting,
    PointerMap,
    ProgressManager,
    Scene,
    WheelMap,
} from '@brewsite/core';
import {
    Diagram,
    DiagramCanvas,
    DiagramEdge,
    DiagramEnter,
    DiagramGroup,
    DiagramNode,
    ManualLayout,
} from '@brewsite/diagram';
import {brewflowTheme} from '../../brewflow-sidecar/theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneCfOverview: JSX.Element = (
  <Scene key="bfc-cf-overview" id="bfc-cf-overview">
    <ProgressManager scrollUnits={2600} fn={DWELL_FN} />

    <Camera mode="world" position={[0, 5, 26]} target={[0, 0, 0]} fov={52} />
    <Background color="#080b14" />

    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bfc-cf-canvas">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bfc-cf-canvas">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bfc-cf-canvas">
        <KeyMap keyName="r" />
      </Action>
    </InputController>

    <DiagramCanvas id="bfc-cf-canvas" position={[0, config.diagramTop, 0]} rotation={[config.diagramRotationX, 0, 0]} scale={config.diagramScale} theme={brewflowTheme}>
      <Diagram id="cf-overview" pivot="center">
        <ManualLayout />
        <DiagramEnter fade scaleFrom={0.85} />

        {/* Center hub */}
        <DiagramNode id="cf-db" label=".swarm/memory.db" sublabel="SQLite · single file · 12 tables" size={[7, 2.8]} position={[0, 0, 0]} color="#1a2030" />

        {/* Core Storage cluster — top-left around [-12, 5, 0] */}
        <DiagramGroup id="cf-core" label="Core Storage" variant="cluster">
          <DiagramNode id="cf-memstore" label="memory_store" sublabel="key-value · namespace · TTL" size={[5.5, 2.2]} position={[-12, 8.0, 0]} color="#101828" />
          <DiagramNode id="cf-sessions" label="sessions" sublabel="cross-session context" size={[5.5, 2.2]} position={[-12, 5.5, 0]} color="#101828" />
          <DiagramNode id="cf-agents" label="agents" sublabel="registry · config · state" size={[5.5, 2.2]} position={[-12, 3.0, 0]} color="#101828" />
          <DiagramNode id="cf-tasks" label="tasks" sublabel="tracking · deps · status" size={[5.5, 2.2]} position={[-12, 0.5, 0]} color="#101828" />
        </DiagramGroup>

        {/* Coordination cluster — top-right around [12, 5, 0] */}
        <DiagramGroup id="cf-coord" label="Coordination" variant="cluster">
          <DiagramNode id="cf-shared" label="shared_state" sublabel="cross-agent blackboard · versioned" size={[5.5, 2.2]} position={[12, 8.0, 0]} color="#101828" />
          <DiagramNode id="cf-agmem" label="agent_memory" sublabel="per-agent state" size={[5.5, 2.2]} position={[12, 5.5, 0]} color="#101828" />
          <DiagramNode id="cf-events" label="events" sublabel="audit log" size={[5.5, 2.2]} position={[12, 3.0, 0]} color="#101828" />
          <DiagramNode id="cf-topology" label="swarm_topology" sublabel="agent relationships" size={[5.5, 2.2]} position={[12, 0.5, 0]} color="#101828" />
        </DiagramGroup>

        {/* Intelligence cluster — bottom-left around [-12, -5, 0] */}
        <DiagramGroup id="cf-intel" label="Intelligence" variant="cluster">
          <DiagramNode id="cf-patterns" label="patterns" sublabel="usage_count · confidence" size={[5.5, 2.2]} position={[-12, -3.5, 0]} color="#101828" />
          <DiagramNode id="cf-perf" label="performance_metrics" sublabel="latency · throughput" size={[5.5, 2.2]} position={[-12, -6.0, 0]} color="#101828" />
        </DiagramGroup>

        {/* Recovery cluster — bottom-right around [12, -5, 0] */}
        <DiagramGroup id="cf-recov" label="Recovery" variant="cluster">
          <DiagramNode id="cf-workflow" label="workflow_state" sublabel="crash-recovery checkpoints" size={[5.5, 2.2]} position={[12, -3.5, 0]} color="#101828" />
          <DiagramNode id="cf-consensus" label="consensus_state" sublabel="quorum voting · ≥2 acceptors" size={[5.5, 2.2]} position={[12, -6.0, 0]} color="#101828" />
        </DiagramGroup>

        {/* Edges from center db to each group representative node */}
        <DiagramEdge from="cf-db" to="cf-memstore" arrowEnd="none" color="#3a5070" />
        <DiagramEdge from="cf-db" to="cf-shared" arrowEnd="none" color="#3a5070" />
        <DiagramEdge from="cf-db" to="cf-patterns" arrowEnd="none" color="#3a5070" />
        <DiagramEdge from="cf-db" to="cf-workflow" arrowEnd="none" color="#3a5070" />
      </Diagram>
    </DiagramCanvas>

    {/* Prose panel */}
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: '40px 64px 48px',
      background: 'rgba(8, 11, 20, 0.88)',
      backdropFilter: 'blur(16px)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      maxHeight: '55vh',
      overflowY: 'auto',
      pointerEvents: 'auto',
    }}>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.67rem',
        letterSpacing: '0.25em',
        textTransform: 'uppercase' as const,
        color: 'rgba(100, 140, 220, 0.7)',
        marginBottom: 16,
      }}>
        WHAT CLAUDE-FLOW'S MEMORY ACTUALLY IS
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        <div>
          <h3 style={{ fontSize: '1rem', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
            A SQLite blackboard with 12 tables
          </h3>
          <p style={{ fontSize: '0.89rem', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 16px' }}>
            claude-flow stores all swarm state in a single SQLite file at .swarm/memory.db.
            The 12 tables fall into four categories: Core Storage (memory_store, sessions,
            agents, tasks), Coordination (shared_state, agent_memory, events, swarm_topology),
            Intelligence (patterns, performance_metrics), and Recovery (workflow_state,
            consensus_state).
          </p>
          <h3 style={{ fontSize: '1rem', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
            Where it excels
          </h3>
          <p style={{ fontSize: '0.89rem', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: 0 }}>
            The simplicity is a feature. A single file, standard SQL queries, no external
            services. For coordinating multiple agents on bounded tasks — delegating subtasks,
            tracking completion, sharing intermediate results — this model is effective and
            easy to reason about. The shared_state table in particular is an elegant
            coordination primitive.
          </p>
        </div>
        <div>
          <h3 style={{ fontSize: '1rem', color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
            The honest limitations
          </h3>
          <p style={{ fontSize: '0.89rem', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 16px' }}>
            The patterns table accumulates frequency counts and confidence scores for
            observed behaviors, but there is no validation pipeline — LLM-generated patterns
            are stored directly without epistemic separation between hypothesis and verified
            fact. The events table is a generic audit log without global ordering or lineage
            tracking, making post-incident investigation difficult.
          </p>
          <p style={{ fontSize: '0.89rem', color: 'rgba(160, 180, 220, 0.65)', lineHeight: 1.7, fontStyle: 'italic', margin: 0 }}>
            These are not bugs — they are the expected characteristics of a system optimized
            for swarm coordination simplicity rather than long-term knowledge accumulation.
          </p>
        </div>
      </div>
    </div>
  </Scene>
);
