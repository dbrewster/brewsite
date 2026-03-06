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
import {Diagram, DiagramCanvas, DiagramEdge, DiagramEnter, DiagramNode, ManualLayout,} from '@brewsite/diagram';
import {brewflowTheme} from '../../brewflow-sidecar/theme';
import {config} from "../../settings";

const DWELL_FN = (t: number): number => Math.min(1, t * 4);

export const sceneNeocortexScopes: JSX.Element = (
  <Scene key="bfmu-neocortex" id="bfmu-neocortex">
    <ProgressManager scrollUnits={2800} fn={DWELL_FN} />
    <InputController scope="canvas">
      <Action id="pan" type="diagram-canvas.move" canvasId="bfmu-neo-canvas">
        <PointerMap event="drag" axis="xy" />
        <WheelMap axis="xy" />
      </Action>
      <Action id="rotate" type="diagram-canvas.rotate" canvasId="bfmu-neo-canvas">
        <PointerMap event="drag" button="left" modifiers={['meta']} axis="xy" />
      </Action>
      <Action id="reset" type="diagram-canvas.reset" canvasId="bfmu-neo-canvas">
        <KeyMap keyName="r" />
      </Action>
    </InputController>
    <Camera mode="world" position={[0, 5, 24]} target={[0, 0, 0]} fov={52} />
    <Background color="#080b14" />

    <DiagramCanvas id="bfmu-neo-canvas" position={[0, 2, 0]} rotation={[config.diagramRotationX, 0, 0]} scale={config.diagramScale} theme={brewflowTheme}>
      <Diagram id="neo-diagram">
        <ManualLayout />
        <DiagramEnter fade />

        {/* Three Neocortex planes */}
        <DiagramNode
          id="neo-org"
          label="Org-Neocortex"
          sublabel="tenantId · org-wide invariants · security · compliance · ALWAYS human approval"
          shape="rectangle"
          size={[12, 2.8]}
          position={[0, 6, 0]}
          color="#1a1025"
          glow={{ intensity: 0.1 }}
        />
        <DiagramNode
          id="neo-project"
          label="Project-Neocortex"
          sublabel="tenantId + projectId · deployment procedures · architecture constraints · ≥2 independent user sessions"
          shape="rectangle"
          size={[12, 2.8]}
          position={[0, 1.5, 0]}
          color="#141830"
          glow={{ intensity: 0.13 }}
        />
        <DiagramNode
          id="neo-user"
          label="User-Neocortex"
          sublabel="tenantId + projectId + userId · personal workflow patterns · auto-verify allowed"
          shape="rectangle"
          size={[12, 2.8]}
          position={[0, -3, 0]}
          color="#121828"
        />

        {/* Promotion arrows */}
        <DiagramEdge
          from="neo-user"
          to="neo-project"
          label="≥2 users · evidence threshold"
          style="dashed"
          arrowEnd="open"
          color="#5070b0"
        />
        <DiagramEdge
          from="neo-project"
          to="neo-org"
          label="human approval always"
          style="dashed"
          arrowEnd="open"
          color="#6080c0"
        />

        {/* Context pack assembly */}
        <DiagramNode
          id="pack-1"
          label="1. Org constraints first"
          shape="rectangle"
          size={[5.5, 2.0]}
          position={[12, 5, 0]}
          color="#1a1020"
        />
        <DiagramNode
          id="pack-2"
          label="2. Project knowledge"
          shape="rectangle"
          size={[5.5, 2.0]}
          position={[12, 2, 0]}
          color="#141830"
        />
        <DiagramNode
          id="pack-3"
          label="3. User knowledge last"
          shape="rectangle"
          size={[5.5, 2.0]}
          position={[12, -1, 0]}
          color="#121828"
        />

        <DiagramEdge from="pack-1" to="pack-2" color="#4060a0" />
        <DiagramEdge from="pack-2" to="pack-3" color="#4060a0" />
      </Diagram>
    </DiagramCanvas>

    <TextBox id="neocortex-prose" x={0} y={0.58} w={1} h={0.42}>
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
          THREE NEOCORTEX PLANES
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#c8a0e8', marginBottom: 6 }}>User-Neocortex</div>
            <div style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.6 }}>
              Personal workflow patterns: preferred commands, personal pitfalls, naming conventions.
              Partition key: <code style={{ fontSize: '14px' }}>tenantId+projectId+userId</code>.
              Auto-verify is permitted here — one user's session is sufficient evidence.
            </div>
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#80a8e8', marginBottom: 6 }}>Project-Neocortex</div>
            <div style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.6 }}>
              Shared engineering knowledge: deployment procedures, architectural constraints, known
              pitfalls. Requires ≥2 independent user sessions to corroborate before promotion.
              Conflicts are surfaced for human resolution.
            </div>
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#6070c0', marginBottom: 6 }}>Org-Neocortex</div>
            <div style={{ fontSize: '15px', color: 'rgba(180, 200, 240, 0.7)', lineHeight: 1.6 }}>
              Org-wide invariants: security constraints, compliance requirements, never-do-X rules.
              Human approval is always required, no exceptions. Context packs always inject org
              constraints first — they cannot be overridden by project or user knowledge.
            </div>
          </div>
        </div>
        <div style={{
          marginTop: 20,
          fontSize: '15px',
          color: 'rgba(160, 180, 220, 0.65)',
          fontStyle: 'italic',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: 16,
        }}>
          Context pack assembly order ensures that a user's personal preference can never shadow an org-level constraint.
          When planes conflict, the higher-authority plane wins and the conflict is logged.
        </div>
      </div>
    </TextBox>
  </Scene>
);
