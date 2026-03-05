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
  WheelMap
} from '@brewsite/core';
import {Diagram, DiagramCanvas, DiagramEdge, DiagramNode, FlowLayout,} from '@brewsite/diagram';
import {brewflowTheme} from '../theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneSequenceNormal: JSX.Element = (
  <Scene key="bf-seq-normal" id="bf-seq-normal">
    <ProgressManager scrollUnits={2800} fn={DWELL_FN} />
    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bf-seq-normal">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bf-seq-normal">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bf-seq-normal">
        <KeyMap keyName="r" />
      </Action>
    </InputController>
    <Camera mode="world" position={[0, 5, 24]} target={[0, 0, 0]} fov={54} />
    <Background color="#080b14" />

    <DiagramCanvas id="bf-seq-normal" position={[0, config.diagramTop, 0]} rotation={[config.diagramRotationX, 0, 0]} scale={config.diagramScale} theme={brewflowTheme}>
      <Diagram id="seq-normal" pivot="center">
        <FlowLayout direction="top-down" gap={3} />

        <DiagramNode
          id="actor-queen"
          label="Queen"
          sublabel="orchestrator"
          shape="rectangle"
          size={[5, 2.8]}
          color="#1a2550"
        />
        <DiagramNode
          id="actor-mcp"
          label="BrewFlow MCP"
          sublabel="recall · store · checkpoint"
          shape="rectangle"
          size={[5, 2.8]}
          color="#1a1d35"
          glow={{ intensity: 0.12 }}
        />
        <DiagramNode
          id="actor-worker"
          label="Worker Agent"
          sublabel="task executor"
          shape="rectangle"
          size={[5, 2.8]}
          color="#1a2550"
        />
        <DiagramNode
          id="actor-episodic"
          label="EpisodicStore"
          sublabel=".brewflow/episodic/"
          shape="rectangle"
          size={[5, 2.8]}
          color="#141830"
        />

        <DiagramEdge from="actor-queen" to="actor-mcp" label="recall(intent)" flow="forward" color="#6080c0" />
        <DiagramEdge from="actor-mcp" to="actor-queen" label="context pack" style="dashed" color="#4060a0" />
        <DiagramEdge from="actor-queen" to="actor-worker" label="spawn + instructions + context" flow="forward" color="#6080c0" />
        <DiagramEdge from="actor-worker" to="actor-episodic" label="tool calls (CDC)" flow="forward" style="dashed" color="#4060a0" />
        <DiagramEdge from="actor-worker" to="actor-mcp" label="store(discovered X)" color="#6080c0" />
        <DiagramEdge from="actor-mcp" to="actor-episodic" label="append synaptic_event" flow="forward" color="#5070b0" />
        <DiagramEdge from="actor-queen" to="actor-mcp" label="log_outcome(success)" color="#6080c0" />
      </Diagram>
    </DiagramCanvas>

    <TextBox id="seq-normal-prose" x={0} y={0.58} w={1} h={0.42}>
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
          NORMAL TASK EXECUTION
        </div>
        <ol style={{ margin: 0, padding: '0 0 0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            'Queen receives a task assignment. Before spawning a worker, it calls recall(intent) on the BrewFlow MCP server.',
            'MCP returns a context pack: relevant constraints, known pitfalls, applicable procedures from the Neocortex.',
            'Queen spawns the Worker with task instructions that include the context pack. Worker has relevant prior knowledge without any memory API calls of its own.',
            'Worker executes. All tool calls are passively captured by the CDC bridge and written to EpisodicStore.',
            'If Worker discovers a reusable fact, it calls store() on the MCP server. That fact becomes a synaptic_event candidate.',
            'On task completion, Queen calls log_outcome(task, success=true). This high-quality signal improves dreamer evidence scoring.',
          ].map((step, i) => (
            <li key={i} style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.8)', lineHeight: 1.6 }}>{step}</li>
          ))}
        </ol>
      </div>
    </TextBox>
  </Scene>
);
