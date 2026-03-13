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
import {Diagram, DiagramEdge, DiagramEnter, DiagramNode, ManualLayout,} from '@brewsite/diagram';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const SceneEpisodicPartition = () => (
  <Scene key="bfmu-episodic" id="bfmu-episodic">
    <ProgressManager scrollUnits={2800} fn={DWELL_FN} />
    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bfmu-ep-canvas">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bfmu-ep-canvas">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bfmu-ep-canvas">
        <KeyMap keyName="r" />
      </Action>
    </InputController>
    <Camera mode="world" position={[0, 5, 22]} target={[0, 0, 0]} fov={52} />
    <Background color="#080b14" />

    <Diagram id="ep-diagram">
        <ManualLayout />
        <DiagramEnter fade />

        {/* Left — partition path tree */}
        <DiagramNode
          id="ep-tenant"
          label="tenants/<tenantId>"
          shape="rectangle"
          size={[0.250, 0.128]}
          position={[0.179, 0.151, 0]}
          color="#141830"
        />
        <DiagramNode
          id="ep-project"
          label="projects/<projectId>"
          shape="rectangle"
          size={[0.250, 0.128]}
          position={[0.179, 0.326, 0]}
          color="#141830"
        />
        <DiagramNode
          id="ep-user"
          label="users/<userId>"
          shape="rectangle"
          size={[0.250, 0.128]}
          position={[0.179, 0.500, 0]}
          color="#141830"
          glow={{ intensity: 0.1 }}
        />
        <DiagramNode
          id="ep-session"
          label="sessions/<sessionId>"
          shape="rectangle"
          size={[0.250, 0.128]}
          position={[0.179, 0.674, 0]}
          color="#141830"
        />
        <DiagramNode
          id="ep-agent"
          label="agents/<agentId>/threads/<threadId>"
          shape="rectangle"
          size={[0.250, 0.128]}
          position={[0.179, 0.849, 0]}
          color="#141830"
          glow={{ intensity: 0.12 }}
        />

        <DiagramEdge from="ep-tenant" to="ep-project" flow="forward" color="#5070b0" />
        <DiagramEdge from="ep-project" to="ep-user" flow="forward" color="#5070b0" />
        <DiagramEdge from="ep-user" to="ep-session" flow="forward" color="#5070b0" />
        <DiagramEdge from="ep-session" to="ep-agent" flow="forward" color="#5070b0" />

        {/* Right — three sequence numbers */}
        <DiagramNode
          id="seq-agent"
          label="agentEventSeq"
          sublabel="per agent · low contention · distributed lock"
          shape="rectangle"
          size={[0.250, 0.140]}
          position={[0.821, 0.267, 0]}
          color="#141830"
          glow={{ intensity: 0.1 }}
        />
        <DiagramNode
          id="seq-session"
          label="sessionEventSeq"
          sublabel="per session · replay ordering · optimistic retry"
          shape="rectangle"
          size={[0.250, 0.140]}
          position={[0.821, 0.500, 0]}
          color="#141830"
        />
        <DiagramNode
          id="seq-project"
          label="projectEventSeq"
          sublabel="per project · async stamping · audit + cross-user replay"
          shape="rectangle"
          size={[0.250, 0.140]}
          position={[0.821, 0.733, 0]}
          color="#141830"
        />

        <DiagramEdge from="seq-agent" to="seq-session" color="#4060a0" style="dashed" />
        <DiagramEdge from="seq-session" to="seq-project" color="#4060a0" style="dashed" />
    </Diagram>

    <TextBox id="episodic-prose" x={0} y={0.58} w={1} h={0.42}>
      <div style={{
        padding: '36px 60px 44px',
        background: 'rgba(8,11,20,0.88)',
        backdropFilter: 'blur(16px)',
        height: '100%',
        boxSizing: 'border-box',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        overflowY: 'auto',
        pointerEvents: 'auto',
      }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '13px',
          letterSpacing: '0.25em',
          textTransform: 'uppercase' as const,
          color: 'rgba(100, 140, 220, 0.7)',
          marginBottom: 16,
        }}>
          EPISODIC PARTITIONING
        </div>
        <p style={{ fontSize: '18px', fontWeight: 600, color: '#c8d8f0', margin: '0 0 16px' }}>
          No coordination needed because no two identities share a write path.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: 'rgba(100, 140, 220, 0.7)', marginBottom: 6 }}>agentEventSeq</div>
            <div style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.6 }}>
              Incremented per-agent. Each agent has its own counter, so concurrent agents in the same
              session never contend. A distributed lock on the agent partition key is sufficient.
            </div>
          </div>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: 'rgba(100, 140, 220, 0.7)', marginBottom: 6 }}>sessionEventSeq</div>
            <div style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.6 }}>
              Stamped asynchronously for replay ordering within a session. Uses optimistic retry —
              if the stamp fails, the agent retries without blocking its main work.
            </div>
          </div>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: 'rgba(100, 140, 220, 0.7)', marginBottom: 6 }}>projectEventSeq</div>
            <div style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.6 }}>
              Stamped by a background worker after the event is durable. Enables cross-user event
              replay and audit. Never on the critical write path — agents never wait for it.
            </div>
          </div>
        </div>
      </div>
    </TextBox>
  </Scene>
);
