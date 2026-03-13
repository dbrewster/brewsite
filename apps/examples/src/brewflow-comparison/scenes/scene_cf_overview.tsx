import type {JSX} from 'react';
import {
    ProgressManager,
    Scene,
    TextBox,
} from '@brewsite/core';
import {
    Diagram,
    DiagramEdge,
    DiagramGroup,
    DiagramNode,
    FlowLayout,
    GridLayout,
} from '@brewsite/diagram';
import {brewflowTheme} from '../../brewflow-sidecar/theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const SceneCfOverview = () => (
  <Scene key="bfc-cf-overview" id="bfc-cf-overview">
    <ProgressManager scrollUnits={2600} fn={DWELL_FN} />

    <Diagram id="cf-overview" x={0} y={0} w={1} h={0.60} tilt={config.diagramRotationX} scale={config.diagramScale} theme={brewflowTheme}>
        <FlowLayout direction="top-down" gap={1.05} />

        <DiagramNode
          id="cf-db"
          label=".swarm/memory.db"
          sublabel="SQLite · single file · 12 tables"
          size={[8.8, 2.5]}
          color="#1a2030"
          glow={{ intensity: 0.12 }}
        />

        <DiagramGroup id="cf-categories" variant="container">
          <GridLayout columns={2} spacing={[1.9, 1.1]} />

          <DiagramGroup id="cf-core" label="Core Storage" variant="cluster">
            <FlowLayout direction="top-down" gap={0.72} />
            <DiagramNode id="cf-memstore" label="memory_store" sublabel="key-value · namespace · TTL" size={[5.0, 1.55]} color="#101828" />
            <DiagramNode id="cf-sessions" label="sessions" sublabel="cross-session context" size={[5.0, 1.55]} color="#101828" />
            <DiagramNode id="cf-agents" label="agents" sublabel="registry · config · state" size={[5.0, 1.55]} color="#101828" />
            <DiagramNode id="cf-tasks" label="tasks" sublabel="tracking · deps · status" size={[5.0, 1.55]} color="#101828" />
          </DiagramGroup>

          <DiagramGroup id="cf-coord" label="Coordination" variant="cluster">
            <FlowLayout direction="top-down" gap={0.72} />
            <DiagramNode id="cf-shared" label="shared_state" sublabel="cross-agent blackboard · versioned" size={[5.0, 1.55]} color="#101828" />
            <DiagramNode id="cf-agmem" label="agent_memory" sublabel="per-agent state" size={[5.0, 1.55]} color="#101828" />
            <DiagramNode id="cf-events" label="events" sublabel="audit log" size={[5.0, 1.55]} color="#101828" />
            <DiagramNode id="cf-topology" label="swarm_topology" sublabel="agent relationships" size={[5.0, 1.55]} color="#101828" />
          </DiagramGroup>

          <DiagramGroup id="cf-intel" label="Intelligence" variant="cluster">
            <FlowLayout direction="top-down" gap={0.72} />
            <DiagramNode id="cf-patterns" label="patterns" sublabel="usage_count · confidence" size={[5.0, 1.55]} color="#101828" />
            <DiagramNode id="cf-perf" label="performance_metrics" sublabel="latency · throughput" size={[5.0, 1.55]} color="#101828" />
          </DiagramGroup>

          <DiagramGroup id="cf-recov" label="Recovery" variant="cluster">
            <FlowLayout direction="top-down" gap={0.72} />
            <DiagramNode id="cf-workflow" label="workflow_state" sublabel="crash-recovery checkpoints" size={[5.0, 1.55]} color="#101828" />
            <DiagramNode id="cf-consensus" label="consensus_state" sublabel="quorum voting · ≥2 acceptors" size={[5.0, 1.55]} color="#101828" />
          </DiagramGroup>
        </DiagramGroup>

        <DiagramEdge from="cf-db" to="cf-core"  routing="flow"  arrowEnd="none" color="#3a5070" flow='forward' />
        <DiagramEdge from="cf-db" to="cf-coord" routing="flow" arrowEnd="none" color="#3a5070" flow='forward' />
        <DiagramEdge from="cf-db" to="cf-intel" routing="flow" arrowEnd="none" color="#3a5070" flow='forward' />
        <DiagramEdge from="cf-db" to="cf-recov" routing="flow" arrowEnd="none" color="#3a5070" flow='forward' />
    </Diagram>

    <TextBox id="cf-overview-prose" x={0} y={0.60} w={1} h={0.40}>
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
          WHAT CLAUDE-FLOW'S MEMORY ACTUALLY IS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          <div>
            <h3 style={{ fontSize: 26, color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
              A SQLite blackboard with 12 tables
            </h3>
            <p style={{ fontSize: 18, color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 16px' }}>
              claude-flow stores all swarm state in a single SQLite file at .swarm/memory.db.
              The 12 tables fall into four categories: Core Storage (memory_store, sessions,
              agents, tasks), Coordination (shared_state, agent_memory, events, swarm_topology),
              Intelligence (patterns, performance_metrics), and Recovery (workflow_state,
              consensus_state).
            </p>
            <h3 style={{ fontSize: 26, color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
              Where it excels
            </h3>
            <p style={{ fontSize: 18, color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: 0 }}>
              The simplicity is a feature. A single file, standard SQL queries, no external
              services. For coordinating multiple agents on bounded tasks — delegating subtasks,
              tracking completion, sharing intermediate results — this model is effective and
              easy to reason about. The shared_state table in particular is an elegant
              coordination primitive.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: 26, color: '#c8d8f0', margin: '0 0 12px', fontWeight: 600 }}>
              The honest limitations
            </h3>
            <p style={{ fontSize: 18, color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 16px' }}>
              The patterns table accumulates frequency counts and confidence scores for
              observed behaviors, but there is no validation pipeline — LLM-generated patterns
              are stored directly without epistemic separation between hypothesis and verified
              fact. The events table is a generic audit log without global ordering or lineage
              tracking, making post-incident investigation difficult.
            </p>
            <p style={{ fontSize: 15, color: 'rgba(160, 180, 220, 0.65)', lineHeight: 1.7, fontStyle: 'italic', margin: 0 }}>
              These are not bugs — they are the expected characteristics of a system optimized
              for swarm coordination simplicity rather than long-term knowledge accumulation.
            </p>
          </div>
        </div>
      </div>
    </TextBox>
  </Scene>
);
