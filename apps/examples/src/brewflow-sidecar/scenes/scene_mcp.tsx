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
  WheelMap
} from '@brewsite/core';
import {Diagram, DiagramCanvas, DiagramEdge, DiagramNode, HierarchicalLayout,} from '@brewsite/diagram';
import {brewflowTheme} from '../theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneMcp: JSX.Element = (
  <Scene key="bf-mcp" id="bf-mcp">
    <ProgressManager scrollUnits={3200} fn={DWELL_FN} />
    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bf-mcp-tools">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bf-mcp-tools">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bf-mcp-tools">
        <KeyMap keyName="r" />
      </Action>
    </InputController>
    <Camera mode="world" position={[0, 4, 20]} target={[0, 0, 0]} fov={52} />
    <Background color="#080b14" />

    <DiagramCanvas id="bf-mcp-tools" position={[0, config.diagramTop, 0]} rotation={[config.diagramRotationX, 0, 0]} scale={config.diagramScale} theme={brewflowTheme}>
      <Diagram id="mcp-tools" pivot="center">
        <HierarchicalLayout direction="left-right" spacing={[3, 2]} />

        <DiagramNode
          id="mcp-server"
          label="brewflow-mcp-server"
          sublabel="Node.js · MCP SDK · async queue"
          shape="rectangle"
          size={[8, 2.8]}
          color="#162050"
          glow={{ intensity: 0.15 }}
        />
        <DiagramNode
          id="tool-recall"
          label="recall()"
          sublabel="Neocortex context pack · constraints · procedures · pitfalls"
          size={[6.5, 2.4]}
          color="#1a2545"
        />
        <DiagramNode
          id="tool-store"
          label="store()"
          sublabel="Persist fact/rule → EpisodicStore candidate"
          size={[6.5, 2.4]}
          color="#1a2545"
        />
        <DiagramNode
          id="tool-procedures"
          label="get_procedures()"
          sublabel="Focused procedure retrieval by intent"
          size={[6.5, 2.4]}
          color="#1a2545"
        />
        <DiagramNode
          id="tool-checkpoint"
          label="checkpoint()"
          sublabel="Memory schematic · restart packet · failure context"
          size={[6.5, 2.4]}
          color="#1a2545"
        />
        <DiagramNode
          id="tool-outcome"
          label="log_outcome()"
          sublabel="Verified outcome signal → dreamer evidence scoring"
          size={[6.5, 2.4]}
          color="#1a2545"
        />
        <DiagramNode
          id="tool-dream"
          label="trigger_dream()"
          sublabel="Kick off consolidation pipeline · background process"
          size={[6.5, 2.4]}
          color="#1a2545"
        />

        <DiagramEdge from="mcp-server" to="tool-recall" arrowEnd="open" color="#4060a0" />
        <DiagramEdge from="mcp-server" to="tool-store" arrowEnd="open" color="#4060a0" />
        <DiagramEdge from="mcp-server" to="tool-procedures" arrowEnd="open" color="#4060a0" />
        <DiagramEdge from="mcp-server" to="tool-checkpoint" arrowEnd="open" color="#4060a0" />
        <DiagramEdge from="mcp-server" to="tool-outcome" arrowEnd="open" color="#4060a0" />
        <DiagramEdge from="mcp-server" to="tool-dream" arrowEnd="open" color="#4060a0" />
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
        COMPONENT 2: THE MCP SERVER
      </div>

      <p style={{ fontSize: '0.89rem', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.6, margin: '0 0 16px' }}>
        One entry in .mcp.json registers the server for all agents:{' '}
        <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: '#8ab4f8', background: 'rgba(100, 140, 220, 0.1)', padding: '1px 5px', borderRadius: 3 }}>
          npx @brewflow/mcp-server
        </code>
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '16px',
      }}>
        {[
          { name: 'recall(intent)', desc: 'Returns a Neocortex context pack: constraints, procedures, and known pitfalls relevant to the given intent string.' },
          { name: 'store(fact)', desc: 'Persists a discovered fact or rule as an EpisodicStore candidate. Feeds the evidence pool for dreamer consolidation.' },
          { name: 'get_procedures(intent)', desc: 'Focused retrieval of step-by-step procedures matching the given intent. Lower latency than full recall().' },
          { name: 'checkpoint(agent, task, ctx)', desc: 'Assembles a memory schematic: prior attempts, known pitfalls, partial progress. Critical for failure recovery.' },
          { name: 'log_outcome(task, success)', desc: 'Records a verified outcome signal. High-quality evidence for dreamer promotion decisions.' },
          { name: 'trigger_dream(session_id)', desc: 'Kicks off the 7-stage consolidation pipeline as a background process. Called by session-end hook.' },
        ].map((tool) => (
          <div key={tool.name} style={{ padding: '12px 16px', background: 'rgba(20, 28, 60, 0.5)', borderRadius: 6, border: '1px solid rgba(100, 140, 220, 0.12)' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: '#8ab4f8', marginBottom: 8 }}>{tool.name}</div>
            <div style={{ fontSize: '0.83rem', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.6 }}>{tool.desc}</div>
          </div>
        ))}
      </div>
    </div>
  </Scene>
);
