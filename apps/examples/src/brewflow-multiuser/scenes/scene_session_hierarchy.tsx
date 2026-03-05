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
import {Diagram, DiagramCanvas, DiagramEdge, DiagramEnter, DiagramNode, HierarchicalLayout,} from '@brewsite/diagram';
import {brewflowTheme} from '../../brewflow-sidecar/theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneSessionHierarchy: JSX.Element = (
  <Scene key="bfmu-sessions" id="bfmu-sessions">
    <ProgressManager scrollUnits={2600} fn={DWELL_FN} />
    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bfmu-sess-canvas">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bfmu-sess-canvas">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bfmu-sess-canvas">
        <KeyMap keyName="r" />
      </Action>
    </InputController>
    <Camera mode="world" position={[0, 5, 20]} target={[0, 0, 0]} fov={52} />
    <Background color="#080b14" />

    <DiagramCanvas id="bfmu-sess-canvas" position={[0, 2, 0]} rotation={[config.diagramRotationX, 0, 0]} scale={config.diagramScale} theme={brewflowTheme}>
      <Diagram id="sess-diagram" pivot="center">
        <HierarchicalLayout direction="top-down" spacing={[2, 2]} />
        <DiagramEnter fade scaleFrom={0.85} />

        <DiagramNode
          id="level-tenant"
          label="Tenant"
          sublabel="hard isolation boundary · org/team"
          shape="rectangle"
          size={[14, 2.4]}
          color="#141830"
        />
        <DiagramNode
          id="level-project"
          label="Project"
          sublabel="repository / product area · default Neocortex scope"
          shape="rectangle"
          size={[12, 2.4]}
          color="#141830"
          glow={{ intensity: 0.1 }}
        />
        <DiagramNode
          id="level-session"
          label="User Session"
          sublabel="one claude-flow queen invocation · bounded start/end/status"
          shape="rectangle"
          size={[10, 2.4]}
          color="#141830"
          glow={{ intensity: 0.12 }}
        />
        <DiagramNode
          id="level-agent"
          label="Agent"
          sublabel="queen + each worker · stable agentId per session"
          shape="rectangle"
          size={[8, 2.4]}
          color="#131a30"
          glow={{ intensity: 0.1 }}
        />
        <DiagramNode
          id="level-thread"
          label="Thread"
          sublabel="one task · leaf-level EpisodicStore partition"
          shape="rectangle"
          size={[6, 2.4]}
          color="#121830"
        />

        <DiagramEdge from="level-tenant" to="level-project" flow="forward" color="#5070b0" />
        <DiagramEdge from="level-project" to="level-session" flow="forward" color="#5070b0" />
        <DiagramEdge from="level-session" to="level-agent" flow="forward" color="#5070b0" />
        <DiagramEdge from="level-agent" to="level-thread" flow="forward" color="#5070b0" />
      </Diagram>
    </DiagramCanvas>

    <TextBox id="sessions-prose" x={0} y={0.58} w={1} h={0.42}>
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
          THE SESSION HIERARCHY
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <p style={{ fontSize: '18px', color: 'rgba(180, 200, 240, 0.8)', lineHeight: 1.7, margin: 0 }}>
              Every partition key in the system is derived from this five-level hierarchy. The
              <strong style={{ color: '#c8d8f0' }}> User Session</strong> is the primary partition
              key — a stable UUID generated at <code style={{ fontSize: '15px', color: 'rgba(120,160,240,0.8)' }}>session_start</code> and
              written into every event, episodic entry, and dreamer run that belongs to it.
            </p>
            <p style={{ fontSize: '15px', color: 'rgba(160, 180, 220, 0.65)', lineHeight: 1.7, marginTop: 12 }}>
              Session record schema: <code style={{ fontSize: '14px', color: 'rgba(120,160,240,0.8)' }}>
                &#123; sessionId, tenantId, projectId, userId, agentId, startedAt, endedAt, status &#125;
              </code>
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { level: 'Tenant', note: 'Hard isolation — two tenants never share any data path' },
              { level: 'Project', note: 'The default scope for Neocortex promotions — "what the team knows"' },
              { level: 'User Session', note: 'Primary partition key — all events are session-scoped' },
              { level: 'Agent', note: 'Stable agentId lets per-agent sequence numbers stay low-contention' },
              { level: 'Thread', note: 'Leaf partition — one task, one write path, no coordination' },
            ].map(({ level, note }) => (
              <div key={level}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: 'rgba(100, 140, 220, 0.7)', marginBottom: 3 }}>{level}</div>
                <div style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.5 }}>{note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </TextBox>
  </Scene>
);
