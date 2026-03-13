import type {JSX} from 'react';
import {
  Background,
  Camera,
  ProgressManager,
  Scene,
  TextBox,
} from '@brewsite/core';
import {Diagram, DiagramEdge, DiagramEnter, DiagramNode, HierarchicalLayout,} from '@brewsite/diagram';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const SceneSurfaces = () => (
  <Scene key="bf-surfaces" id="bf-surfaces">
    <ProgressManager scrollUnits={3200} fn={DWELL_FN} />
    <Camera mode="world" position={[0, 6, 22]} target={[0, 0, 0]} fov={52} />
    <Background color="#080b14" />

    <Diagram id="surfaces-diagram" x={0} y={0} w={1} h={0.58} tilt={-0.15} scale={config.diagramScale}>
        <HierarchicalLayout direction="top-down" spacing={[2, 2]} />

        <DiagramNode
          id="cf-box"
          label="claude-flow"
          sublabel=".swarm/memory.db · agent YAML · .mcp.json"
          shape="rectangle"
          size={[8, 3]}
          color="#1a2540"
        />
        <DiagramNode
          id="bf-box"
          label="BrewFlow Memory Sidecar"
          sublabel="Bridge · MCP Server · Dreamer"
          shape="rectangle"
          size={[8, 3]}
          color="#1a1d35"
          glow={{ intensity: 0.15 }}
        />
        <DiagramNode
          id="surface-hooks"
          label="Hooks"
          sublabel="pre-task · post-task · session-end · CLI commands"
          shape="rectangle"
          size={[6, 2.4]}
          color="#162050"
        />
        <DiagramNode
          id="surface-mcp"
          label="MCP namespace"
          sublabel="mcp__brewflow__* tools · .mcp.json registration"
          shape="rectangle"
          size={[6, 2.4]}
          color="#162050"
        />
        <DiagramNode
          id="surface-sqlite"
          label="SQLite CDC"
          sublabel=".swarm/memory.db · read-only polling · 500ms"
          shape="rectangle"
          size={[6, 2.4]}
          color="#162050"
        />

        <DiagramEdge from="cf-box" to="surface-hooks" arrowEnd="open" style="dashed" color="#4a6090" flow='forward'/>
        <DiagramEdge from="cf-box" to="surface-mcp" arrowEnd="open" style="dashed" color="#4a6090" />
        <DiagramEdge from="cf-box" to="surface-sqlite" arrowEnd="open" style="dashed" color="#4a6090"  flow='forward'/>
        <DiagramEdge from="surface-hooks" to="bf-box" arrowEnd="open" color="#6080c0"  flow='forward'/>
        <DiagramEdge from="surface-mcp" to="bf-box" arrowEnd="open" color="#6080c0" flow='bidirectional'/>
        <DiagramEdge from="surface-sqlite" to="bf-box" arrowEnd="open" color="#6080c0" flow='bidirectional'/>
    </Diagram>

    <TextBox id="surfaces-prose" x={0} y={0.58} w={1} h={0.42}>
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
          THE THREE ATTACHMENT SURFACES
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '24px',
          marginBottom: 20,
        }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#c8d8f0', marginBottom: 8 }}>Hooks</div>
            <div style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.6 }}>
              pre-task/post-task/session-end run arbitrary CLI. Context injection + outcome recording.
              Zero changes to claude-flow source.
            </div>
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#c8d8f0', marginBottom: 8 }}>MCP namespace</div>
            <div style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.6 }}>
              Any MCP server in .mcp.json adds tools all agents can call.
              Memory recall, store, checkpoint, trigger_dream.
            </div>
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#c8d8f0', marginBottom: 8 }}>SQLite CDC</div>
            <div style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.6 }}>
              .swarm/memory.db is a plain SQLite file — read-only polling at 500ms.
              Passive ingestion of all swarm activity without write access.
            </div>
          </div>
        </div>
        <div style={{
          fontSize: '15px',
          color: 'rgba(160, 180, 220, 0.65)',
          fontStyle: 'italic',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: 16,
        }}>
          None of these require touching claude-flow's source.
        </div>
      </div>
    </TextBox>
  </Scene>
);
