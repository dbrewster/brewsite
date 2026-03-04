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
import {FlowLayout} from "@brewsite/diagram/elements/diagram/dsl";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneSequenceFailure: JSX.Element = (
  <Scene key="bf-seq-failure" id="bf-seq-failure">
    <ProgressManager scrollUnits={2400} fn={DWELL_FN} />
    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bf-seq-fail">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bf-seq-fail">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bf-seq-fail">
        <KeyMap keyName="r" />
      </Action>
    </InputController>
    <Camera mode="world" position={[0, 5, 22]} target={[0, 0, 0]} fov={54} />
    <Background color="#080b14" />

    <DiagramCanvas id="bf-seq-fail" position={[0, config.diagramTop, 0]} rotation={[config.diagramRotationX, 0, 0]} scale={config.diagramScale} theme={brewflowTheme}>
      <Diagram id="seq-fail" pivot="center">
        <FlowLayout direction="top-down" gap={3} />

        <DiagramNode
          id="actor-queen"
          label="Queen"
          sublabel="orchestrator"
          size={[5, 2.8]}
          color="#1a2550"
        />
        <DiagramNode
          id="actor-mcp"
          label="BrewFlow MCP"
          sublabel="recall · store · checkpoint"
          size={[5, 2.8]}
          color="#1a1d35"
          glow={{ intensity: 0.12 }}
        />
        <DiagramNode
          id="actorworker-old"
          label="Worker (failed)"
          sublabel="task incomplete"
          size={[5, 2.8]}
          color="#3a1520"
        />
        <DiagramNode
          id="actor-worker-new"
          label="New Worker"
          sublabel="starts from checkpoint"
          size={[5, 2.8]}
          color="#152535"
          glow={{ intensity: 0.1 }}
        />

        <DiagramEdge from="actor-worker-old" to="actor-queen" label="task failed" color="#c04040" arrowEnd="filled" />
        <DiagramEdge from="actor-queen" to="actor-mcp" label="checkpoint(agent, task, 'failure')" color="#6080c0" />
        <DiagramEdge from="actor-mcp" to="actor-queen" label="memory schematic" style="dashed" color="#4060a0" />
        <DiagramEdge from="actor-queen" to="actor-worker-new" label="spawn + instructions + schematic" flow="forward" color="#6080c0" />
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
      maxHeight: '52vh',
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
        FAILED WORKER → CHECKPOINT RESTART
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        <div>
          <h3 style={{ fontSize: '0.94rem', fontWeight: 600, color: '#c8d8f0', margin: '0 0 12px' }}>What the memory schematic contains</h3>
          <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              'The partial work completed before failure (from CDC bridge captures)',
              'Known pitfalls that were hit during the failed attempt',
              'Neocortex constraints relevant to this task type',
              'Prior successful patterns for similar tasks',
              'The exact failure context: error message, last state, attempted approach',
            ].map((item, i) => (
              <li key={i} style={{ fontSize: '0.89rem', color: 'rgba(180, 200, 240, 0.8)', lineHeight: 1.6 }}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 style={{ fontSize: '0.94rem', fontWeight: 600, color: '#c8d8f0', margin: '0 0 12px' }}>Why it matters</h3>
          <p style={{ fontSize: '0.89rem', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: '0 0 12px' }}>
            Without a checkpoint restart packet, the new worker has to re-discover everything
            the failed worker learned. In a complex task this means re-hitting the same pitfalls,
            re-doing completed sub-tasks, and starting from zero context.
          </p>
          <p style={{ fontSize: '0.89rem', color: 'rgba(180, 200, 240, 0.75)', lineHeight: 1.7, margin: 0 }}>
            With checkpoint(), the Queen assembles a memory schematic before spawning the replacement.
            The new worker knows what was tried, what failed, what succeeded, and where to resume.
            Each failed attempt makes the next attempt cheaper.
          </p>
        </div>
      </div>
    </div>
  </Scene>
);
