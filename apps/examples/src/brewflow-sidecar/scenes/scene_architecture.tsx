import type {JSX} from 'react';
import {
  Background,
  Camera,
  ProgressManager,
  Scene,
  TextBox,
} from '@brewsite/core';
import {Diagram, DiagramEdge, DiagramGroup, DiagramNode, ManualLayout,} from '@brewsite/diagram';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const SceneArchitecture = () => (
  <Scene key="bf-architecture" id="bf-architecture">
    <ProgressManager scrollUnits={3200} fn={DWELL_FN} />
    <Camera mode="world" position={[0, 8, 32]} target={[0, 0, 0]} fov={54} />
    <Background color="#080b14" />

    {/* claude-flow block */}
    <Diagram id="bf-arch-cf" x={0} y={0} w={1} h={0.203} tilt={-0.12} scale={config.diagramScale}>
      <ManualLayout />
      <DiagramGroup id="cf-group" label="claude-flow" variant="boundary" color="#0d1525" borderColor="#2a3a60">
        <DiagramNode
          id="cf-db"
          label=".swarm/memory.db"
          sublabel="events · shared_state · patterns · tasks · sessions"
          size={[0.409, 0.483]}
          position={[0.273, 0.500, 0]}
        />
        <DiagramNode
          id="cf-yaml"
          label="agent-template.yaml"
          sublabel="pre/post/session-end hooks → npx brewflow ..."
          size={[0.409, 0.483]}
          position={[0.727, 0.500, 0]}
        />
      </DiagramGroup>
    </Diagram>

    {/* sidecar block */}
    <Diagram id="bf-arch-sidecar" x={0} y={0.203} w={1} h={0.377} tilt={-0.12} scale={config.diagramScale}>
      <ManualLayout />
      <DiagramGroup id="sidecar-group" label="BrewFlow Memory Sidecar" variant="boundary" color="#0d0f1e" borderColor="#3a4080">
        <DiagramNode
          id="proc-bridge"
          label="brewflow-bridge"
          sublabel="Polls .swarm/memory.db (read-only) · rowid cursors · EpisodicStore writes"
          size={[0.276, 0.267]}
          position={[0.190, 0.276, 0]}
          color="#141830"
        />
        <DiagramNode
          id="proc-mcp"
          label="brewflow-mcp-server"
          sublabel="mcp__brewflow__* tools · recall · store · checkpoint · trigger_dream"
          size={[0.276, 0.267]}
          position={[0.500, 0.276, 0]}
          color="#141830"
          glow={{ intensity: 0.12 }}
        />
        <DiagramNode
          id="proc-dreamer"
          label="brewflow-dreamer"
          sublabel="7-stage consolidation · LLM extract → Neocortex promotion"
          size={[0.276, 0.267]}
          position={[0.810, 0.276, 0]}
          color="#141830"
        />
        <DiagramNode
          id="store-episodic"
          label=".brewflow/episodic/"
          sublabel="JSONL segments · EpisodicStore"
          size={[0.190, 0.210]}
          position={[0.328, 0.752, 0]}
          color="#0f1525"
        />
        <DiagramNode
          id="store-neocortex"
          label=".brewflow/neocortex/"
          sublabel="typed JSON cards · verified knowledge"
          size={[0.190, 0.210]}
          position={[0.672, 0.752, 0]}
          color="#0f1525"
        />
      </DiagramGroup>

      {/* Intra-sidecar edges */}
      <DiagramEdge from="proc-bridge" to="store-episodic" flow="forward" color="#5080c0" />
      <DiagramEdge from="proc-mcp" to="store-episodic" color="#5080c0" />
      <DiagramEdge from="proc-dreamer" to="store-neocortex" flow="forward" color="#5080c0" />
      <DiagramEdge from="store-episodic" to="proc-dreamer" style="dashed" color="#4060a0" />
      <DiagramEdge from="store-neocortex" to="proc-mcp" style="dashed" color="#4060a0" />
    </Diagram>
    {/* Cross-diagram connections via DiagramPipe would require DiagramPipe DSL.
        For now we show the connections with an annotation in the prose. */}

    <TextBox id="architecture-prose" x={0} y={0.58} w={1} h={0.42}>
      <div style={{
        padding: '36px 60px 44px',
        background: 'rgba(8, 11, 20, 0.88)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        height: '100%',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '13px',
          letterSpacing: '0.25em',
          textTransform: 'uppercase' as const,
          color: 'rgba(100, 140, 220, 0.7)',
          marginBottom: 16,
        }}>
          FULL ARCHITECTURE
        </div>
        <ul style={{
          margin: 0,
          padding: '0 0 0 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}>
          <li style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.8)', lineHeight: 1.6 }}>
            <strong style={{ color: '#c8d8f0' }}>brewflow-bridge</strong> — A lightweight process
            that watches .swarm/memory.db via read-only SQLite polling. It tracks row cursors per table,
            transforms new rows into EpisodicStore entries, and never writes to claude-flow's database.
          </li>
          <li style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.8)', lineHeight: 1.6 }}>
            <strong style={{ color: '#c8d8f0' }}>brewflow-mcp-server</strong> — A Node.js MCP server
            registered in .mcp.json. Exposes recall(), store(), get_procedures(), checkpoint(),
            log_outcome(), and trigger_dream() to all agents in the swarm.
          </li>
          <li style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.8)', lineHeight: 1.6 }}>
            <strong style={{ color: '#c8d8f0' }}>brewflow-dreamer</strong> — Triggered by the
            session-end hook as a non-blocking background process. Runs a 7-stage consolidation
            pipeline that promotes high-salience episodic content into typed Neocortex cards.
          </li>
        </ul>
      </div>
    </TextBox>
  </Scene>
);
